import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../services/api';
import { AuthService } from '../services/auth';
import { Recurso, StipzStateService } from '../services/stipz-state';
import { SincronizacaoService } from '../services/sincronizacao';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-reservar-sala',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservar-sala.html',
  styleUrls: ['./reservar-sala.css']
})
export class ReservarSalaComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  reserva = {
    salaId: null as number | null,
    data: '',
    horaInicio: '',
    horaFim: '',
    quantidadeParticipantes: null as number | null,
    cadeirasExtras: false,
    quantidadeCadeiras: 0,
    recursos: [] as number[],
    recursoQuantidades: {} as Record<number, number>,
    souResponsavel: true,
    responsavel: ''
  };
  erros: string[] = [];

  constructor(
    public state: StipzStateService,
    private api: ApiService,
    private auth: AuthService,
    private sincronizacao: SincronizacaoService,
    private cdr: ChangeDetectorRef,
    private feedback: FeedbackService
  ) {}

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
        this.carregarDisponibilidadeRecursos();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get recursosDisponiveis() {
    const sala = this.salaSelecionada();
    return this.state.recursos.filter((recurso) => !recurso.fixo || !sala || recurso.sala === sala.nome);
  }

  alternarRecurso(id: number, marcado: boolean) {
    this.reserva.recursos = marcado
      ? [...this.reserva.recursos, id]
      : this.reserva.recursos.filter((item) => item !== id);

    if (marcado && !this.reserva.recursoQuantidades[id]) {
      this.reserva.recursoQuantidades[id] = 1;
    }

    if (!marcado) {
      delete this.reserva.recursoQuantidades[id];
    }
  }

  recursoSelecionado(id: number): boolean {
    return this.reserva.recursos.includes(id);
  }

  quantidadeRecurso(id: number): number {
    return Number(this.reserva.recursoQuantidades[id] || 1);
  }

  quantidadeMaximaRecurso(recurso: Recurso): number {
    return Math.max(this.state.quantidadeDisponivelRecurso(recurso), 0);
  }

  disponibilidadeLabel(recurso: Recurso): string {
    const disponivel = this.quantidadeMaximaRecurso(recurso);
    return `${disponivel} disponível${disponivel === 1 ? '' : 'is'}`;
  }

  atualizarDisponibilidadeRecursos() {
    this.carregarDisponibilidadeRecursos();
  }

  bloquearQuantidadeMaior(event: KeyboardEvent, recurso: Recurso) {
    const maximo = this.quantidadeMaximaRecurso(recurso);
    const tecla = event.key;

    if (event.ctrlKey || event.metaKey || ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(tecla)) {
      return;
    }

    if (!/^\d$/.test(tecla)) {
      event.preventDefault();
      return;
    }

    const input = event.target as HTMLInputElement;
    const inicio = input.selectionStart ?? input.value.length;
    const fim = input.selectionEnd ?? input.value.length;
    const proximoValor = `${input.value.slice(0, inicio)}${tecla}${input.value.slice(fim)}`;

    if (this.quantidadeExcedeDisponivel(proximoValor, maximo)) {
      event.preventDefault();
      this.mostrarErroQuantidade(recurso.nome, maximo);
    }
  }

  bloquearColagemQuantidade(event: ClipboardEvent, recurso: Recurso) {
    const maximo = this.quantidadeMaximaRecurso(recurso);
    const texto = event.clipboardData?.getData('text') || '';

    if (!/^\d+$/.test(texto) || this.quantidadeExcedeDisponivel(texto, maximo)) {
      event.preventDefault();
      this.mostrarErroQuantidade(recurso.nome, maximo);
    }
  }

  validarQuantidadeRecurso(recurso: Recurso) {
    const quantidade = this.quantidadeRecurso(recurso.id);
    const maximo = this.quantidadeMaximaRecurso(recurso);

    if (quantidade > maximo) {
      this.mostrarErroQuantidade(recurso.nome, maximo);
      return;
    }

    this.limparErroQuantidade();
  }

  ajustarQuantidadeParticipantes() {
    const sala = this.salaSelecionada();
    const maxima = Math.max(Number(sala?.capacidade || 1), 1);
    const quantidade = Math.floor(Number(this.reserva.quantidadeParticipantes || 1));

    this.reserva.quantidadeParticipantes = Math.min(Math.max(quantidade, 1), maxima);
  }

  atualizarCadeirasExtras() {
    if (!this.reserva.cadeirasExtras) {
      this.reserva.quantidadeCadeiras = 0;
      return;
    }

    if (Number(this.reserva.quantidadeCadeiras) < 1) {
      this.reserva.quantidadeCadeiras = 1;
    }
  }

  ajustarQuantidadeCadeiras() {
    if (!this.reserva.cadeirasExtras) {
      this.reserva.quantidadeCadeiras = 0;
      return;
    }

    const quantidade = Math.floor(Number(this.reserva.quantidadeCadeiras || 1));
    this.reserva.quantidadeCadeiras = Math.max(quantidade, 1);
  }

  async agendar() {
    this.erros = [];
    if (!this.reserva.salaId) this.erros.push('Sala desejada: selecione uma sala.');
    if (!this.reserva.data) this.erros.push('Data: selecione o dia da reserva.');
    if (!this.reserva.horaInicio) this.erros.push('Horário inicial: informe o início da reserva.');
    if (!this.reserva.horaFim) this.erros.push('Horário final: informe o término da reserva.');
    if (this.reserva.horaInicio && this.reserva.horaFim && this.reserva.horaFim <= this.reserva.horaInicio) {
      this.erros.push('Horário final: deve ser posterior ao horário inicial.');
    }
    if (!this.reserva.quantidadeParticipantes || this.reserva.quantidadeParticipantes < 1) {
      this.erros.push('Quantidade de participantes: informe pelo menos uma pessoa.');
    }
    if (this.reserva.cadeirasExtras && this.reserva.quantidadeCadeiras < 1) {
      this.erros.push('Quantidade de cadeiras extras: informe pelo menos uma cadeira adicional.');
    }
    if (!this.reserva.souResponsavel && !this.reserva.responsavel.trim()) {
      this.erros.push('Nome do responsável: informe quem será responsável pela reserva.');
    }

    const sala = this.salaSelecionada();
    if (sala && this.reserva.quantidadeParticipantes && this.reserva.quantidadeParticipantes > sala.capacidade) {
      this.erros.push(`Quantidade de participantes: ${sala.nome} comporta no máximo ${sala.capacidade} pessoas.`);
    }

    this.reserva.recursos.forEach((recursoId) => {
      const quantidade = this.quantidadeRecurso(recursoId);
      const recurso = this.state.recursos.find((item) => item.id === recursoId);
      if (quantidade < 1 && recurso) this.erros.push(`${recurso.nome}: informe uma quantidade maior que zero.`);
      if (recurso && quantidade > this.quantidadeMaximaRecurso(recurso)) {
        this.erros.push(`Não é possível reservar ${quantidade} unidade(s) de ${recurso.nome}. Existem somente ${this.quantidadeMaximaRecurso(recurso)} disponível(is) nesse horário.`);
      }
    });

    const usuarioId = this.usuarioId();
    if (!usuarioId) this.erros.push('Sessão do usuário: entre novamente para realizar a reserva.');

    if (this.erros.length > 0) {
      this.feedback.erro(this.erros);
      return;
    }

    const confirmado = await this.feedback.confirmar(
      'Confirmar reserva?',
      `Deseja reservar ${sala?.nome} em ${this.reserva.data}, das ${this.reserva.horaInicio} às ${this.reserva.horaFim}?`,
      'Agendar'
    );
    if (!confirmado) return;

    const payload = {
      usuarioId,
      salaId: this.reserva.salaId,
      inicio: `${this.reserva.data}T${this.reserva.horaInicio}:00`,
      fim: `${this.reserva.data}T${this.reserva.horaFim}:00`,
      quantidadeParticipantes: Number(this.reserva.quantidadeParticipantes),
      cadeirasExtras: Boolean(this.reserva.cadeirasExtras),
      quantidadeCadeiras: this.reserva.cadeirasExtras ? Number(this.reserva.quantidadeCadeiras) : 0,
      responsavel: this.nomeResponsavel(),
      nomeResponsavel: this.nomeResponsavel(),
      recursos: this.reserva.recursos.map((recursoId) => ({
        recursoId,
        quantidade: this.quantidadeRecurso(recursoId)
      }))
    };

    this.api.criarReserva(payload).subscribe({
      next: () => {
        this.state.limparReservas();
        this.api.listarMinhasReservas().subscribe({
          next: (reservas) => this.state.setReservas(reservas),
          error: () => {}
        });
        this.reserva = {
          salaId: null,
          data: '',
          horaInicio: '',
          horaFim: '',
          quantidadeParticipantes: null,
          cadeirasExtras: false,
          quantidadeCadeiras: 0,
          recursos: [],
          recursoQuantidades: {},
          souResponsavel: true,
          responsavel: ''
        };
        this.feedback.sucesso('Reserva registrada e enviada para análise.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(this.feedback.mensagemErro(err, 'Não foi possível registrar a reserva.'));
        this.cdr.detectChanges();
      }
    });
  }

  salaSelecionada() {
    return this.state.salas.find((sala) => sala.id === this.reserva.salaId);
  }

  private periodoReservaCompleto(): boolean {
    return Boolean(this.reserva.salaId && this.reserva.data && this.reserva.horaInicio && this.reserva.horaFim);
  }

  private carregarDisponibilidadeRecursos() {
    if (!this.periodoReservaCompleto()) return;

    this.api.listarDisponibilidadeRecursos({
      salaId: this.reserva.salaId,
      inicio: `${this.reserva.data}T${this.reserva.horaInicio}:00`,
      fim: `${this.reserva.data}T${this.reserva.horaFim}:00`
    }).subscribe({
      next: (recursos) => {
        this.state.setRecursos(recursos);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private usuarioId(): number | null {
    const usuario = this.auth.usuarioAtual;
    return usuario?.id || usuario?.usuarioId || usuario?.userId || null;
  }

  private nomeResponsavel(): string {
    if (!this.reserva.souResponsavel) {
      return this.reserva.responsavel.trim();
    }

    const usuario = this.auth.usuarioAtual;
    return usuario?.nome || usuario?.name || usuario?.email || '';
  }

  private quantidadeExcedeDisponivel(valor: string, maximo: number): boolean {
    if (!valor) return false;
    return Number(valor) > maximo || valor.length > String(Math.max(maximo, 1)).length;
  }

  private mostrarErroQuantidade(nomeRecurso: string, maximo: number) {
    const mensagem = `Existem somente ${maximo} unidade(s) de ${nomeRecurso} disponível(is) nesse horário.`;
    this.erros = [mensagem];
    this.feedback.erro(`${nomeRecurso}: ${mensagem}`);
    this.cdr.detectChanges();
  }

  private limparErroQuantidade() {
    this.erros = this.erros.filter((erro) => !erro.includes('disponível(is) nesse horário'));
    this.cdr.detectChanges();
  }

}
