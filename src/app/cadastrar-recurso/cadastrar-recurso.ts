import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../services/api';
import { StipzStateService } from '../services/stipz-state';
import { SincronizacaoService } from '../services/sincronizacao';
import { FeedbackService } from '../services/feedback';


@Component({
  selector: 'app-cadastrar-recurso',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './cadastrar-recurso.html',
  styleUrls: ['./cadastrar-recurso.css']
})
export class CadastrarRecurso implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    public state: StipzStateService,
    private sincronizacao: SincronizacaoService,
    private cdr: ChangeDetectorRef,
    private feedback: FeedbackService
  ) {}

  recurso = {
    salaId: null as number | null,
    nome: '',
    quantidade: 0,
    descricao: '',
    categoria: 'OUTRO',
    fixo: false
  };

  categorias: string[] = [
    'TECNOLOGICO',
    'AUDIOVISUAL',
    'INFORMATICA',
    'MOBILIARIO',
    'DIDATICO',
    'LABORATORIO',
    'LIMPEZA',
    'ALIMENTICIO',
    'APOIO',
    'ELETRICO',
    'SEGURANCA',
    'ACESSIBILIDADE',
    'ESPORTIVO',
    'ADMINISTRATIVO',
    'LOGISTICO',
    'EVENTO',
    'OUTRO'
  ];

  erros: string[] = [];

  ngOnInit() {
    this.carregarDados();

    this.sincronizacao.alteracao$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.carregarDados());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregarDados() {
    this.api.listarSalas().subscribe({
      next: (salas) => {
        this.state.setSalas(salas);
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.api.listarRecursos().subscribe({
      next: (recursos) => {
        this.state.setRecursos(recursos);
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.api.listarReservas().subscribe({
      next: (reservas) => {
        this.state.setReservas(reservas);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  limparMensagens() {
  }

  async cadastrar() {
    this.erros = [];
    this.limparMensagens();

    if (!this.recurso.salaId) {
      this.erros.push('Sala: selecione a sala do recurso.');
    }

    if (!this.recurso.nome.trim()) {
      this.erros.push('Nome do recurso: informe um nome.');
    }

    if (!this.recurso.descricao.trim()) {
      this.erros.push('Descrição: informe uma descrição para o recurso.');
    }

     if (!this.recurso.quantidade || this.recurso.quantidade < 1) {
      this.erros.push('Quantidade: informe uma quantidade maior que zero.');
    }
     if (!this.recurso.categoria) {
      this.erros.push('Categoria: selecione uma categoria.');
    }

    if (this.erros.length > 0) {
      this.feedback.erro(this.erros);
      return;
    }

    const confirmado = await this.feedback.confirmar(
      'Cadastrar recurso?',
      `Confirma o cadastro de ${this.recurso.quantidade} unidade(s) de ${this.recurso.nome}?`,
      'Cadastrar'
    );
    if (!confirmado) return;

    const payload = {
      nome: this.recurso.nome,
      descricao: this.recurso.descricao,
      categoria: this.recurso.categoria,
      quantidade: Number(this.recurso.quantidade),
      salaId: this.recurso.salaId,
      fixo: this.recurso.fixo
    };

    this.api.criarRecurso(payload).subscribe({
      next: (recursoCriado) => {
        this.state.adicionarRecurso({
          sala: recursoCriado?.sala?.nome || this.nomeSalaSelecionada(),
          nome: recursoCriado?.nome || payload.nome,
          quantidade: Number(recursoCriado?.quantidade || payload.quantidade),
          quantidadeReservada: 0,
          quantidadeDisponivel: Number(recursoCriado?.quantidade || payload.quantidade),
          tipo: recursoCriado?.categoria ||
            recursoCriado?.tipoRecurso?.categoria ||
            recursoCriado?.tipoRecurso?.nome ||
            payload.categoria,
          descricao: recursoCriado?.descricao ||
            recursoCriado?.tipoRecurso?.descricao ||
            recursoCriado?.tipoRecurso?.nome ||
            payload.descricao,
          fixo: Boolean(recursoCriado?.fixo ?? payload.fixo)
        });
        this.recurso = { salaId: null, nome: '', quantidade: 0, descricao: '', categoria: 'OUTRO', fixo: false };
        this.feedback.sucesso('Recurso cadastrado com sucesso.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(this.feedback.mensagemErro(err, 'Não foi possível cadastrar o recurso.'));
        this.cdr.detectChanges();
      }
    });
  }

  private nomeSalaSelecionada(): string {
    return this.state.salas.find((sala) => sala.id === this.recurso.salaId)?.nome || '';
  }

  quantidadeReservada(recurso: any): number {
    return this.state.quantidadeReservadaRecurso(recurso);
  }

  quantidadeDisponivel(recurso: any): number {
    return this.state.quantidadeDisponivelRecurso(recurso);
  }
}
