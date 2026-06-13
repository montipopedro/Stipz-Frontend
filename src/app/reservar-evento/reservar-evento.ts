import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../services/api';
import { Recurso, Reserva, Sala, StipzStateService } from '../services/stipz-state';
import { SincronizacaoService } from '../services/sincronizacao';
import { FeedbackService } from '../services/feedback';

interface SalaEvento extends Sala {
  data: string;
  horaInicio: string;
  horaFim: string;
  quantidadeParticipantes: number | null;
  recursos: number[];
  recursoQuantidades: Record<number, number>;
  cadeirasExtras: boolean;
  quantidadeCadeiras: number;
  souResponsavel: boolean;
  responsavel: string;
}

interface EdicaoEventoContexto {
  eventoId: number;
  evento: string;
  observacoes: string;
  justificativa: string;
  salasAprovadas: Reserva[];
  reservaRejeitada: Reserva;
}

@Component({
  selector: 'app-reservar-evento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservar-evento.html',
  styleUrls: ['./reservar-evento.css']
})
export class ReservarEventoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  evento = {
    salaSelecionadaId: null as number | null,
    salas: [] as SalaEvento[],
    salaAtivaId: null as number | null,
    nome: '',
    observacoes: ''
  };
  erros: string[] = [];
  modalJustificativaAberto = false;
  justificativaAgendamento = '';
  erroJustificativa = '';
  disponibilidadePorSala: Record<number, Record<number, number>> = {};
  contextoEdicao: EdicaoEventoContexto | null = null;
  salasDisponiveisEdicao: Sala[] | null = null;
  private edicaoInicializada = false;

  constructor(
    public state: StipzStateService,
    private api: ApiService,
    private sincronizacao: SincronizacaoService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private feedback: FeedbackService
  ) {}

  ngOnInit() {
    this.carregarContextoEdicao();
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
        this.inicializarModoEdicao();
        this.carregarSalasDisponiveisEdicao();
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
  }

  adicionarSala() {
    const sala = this.state.salas.find((item) => item.id === this.evento.salaSelecionadaId);
    if (!sala || this.salaJaSelecionada(sala.id)) return;

    const novaSala = this.criarConfiguracaoSala(sala);
    this.evento.salas = this.modoEdicao ? [novaSala] : [...this.evento.salas, novaSala];
    this.evento.salaAtivaId = sala.id;
    this.evento.salaSelecionadaId = null;
    if (this.periodoSalaCompleto(novaSala)) {
      this.carregarDisponibilidadeRecursosSala(novaSala);
    }
    this.cdr.detectChanges();
  }

  removerSala(salaId: number) {
    this.evento.salas = this.evento.salas.filter((item) => item.id !== salaId);
    if (this.evento.salaAtivaId === salaId) {
      this.evento.salaAtivaId = this.evento.salas[0]?.id || null;
    }
    this.cdr.detectChanges();
  }

  salaJaSelecionada(salaId: number): boolean {
    return this.evento.salas.some((sala) => sala.id === salaId) ||
      this.salasAprovadas.some((reserva) => reserva.salaId === salaId);
  }

  get modoEdicao(): boolean {
    return Boolean(this.contextoEdicao);
  }

  get salasAprovadas(): Reserva[] {
    return this.contextoEdicao?.salasAprovadas || [];
  }

  get reservaRejeitada(): Reserva | null {
    return this.contextoEdicao?.reservaRejeitada || null;
  }

  get salasDisponiveis(): Sala[] {
    const aprovadas = new Set(this.salasAprovadas.map((reserva) => reserva.salaId));
    const origem = this.modoEdicao && this.salasDisponiveisEdicao
      ? this.salasDisponiveisEdicao
      : this.state.salas;
    return origem.filter((sala) => !aprovadas.has(sala.id));
  }

  selecionarSala(salaId: number) {
    this.evento.salaAtivaId = salaId;
    this.cdr.detectChanges();
  }

  get salaAtiva(): SalaEvento | undefined {
    return this.evento.salas.find((sala) => sala.id === this.evento.salaAtivaId);
  }

  alternarRecursoSala(sala: SalaEvento, recursoId: number, marcado: boolean) {
    sala.recursos = marcado
      ? [...sala.recursos, recursoId]
      : sala.recursos.filter((item) => item !== recursoId);

    if (marcado && !sala.recursoQuantidades[recursoId]) {
      sala.recursoQuantidades[recursoId] = 1;
    }

    if (!marcado) {
      delete sala.recursoQuantidades[recursoId];
    }

    this.cdr.detectChanges();
  }

  recursoSelecionadoSala(sala: SalaEvento, recursoId: number): boolean {
    return sala.recursos.includes(recursoId);
  }

  quantidadeRecursoSala(sala: SalaEvento, recursoId: number): number {
    return Number(sala.recursoQuantidades[recursoId] || 1);
  }

  quantidadeMaximaRecurso(recurso: Recurso): number {
    return Math.max(Number(recurso.quantidade || 0), 1);
  }

  quantidadeMaximaRecursoSala(sala: SalaEvento, recurso: Recurso): number {
    const disponivel = this.disponibilidadePorSala[sala.id]?.[recurso.id];
    return disponivel !== undefined ? Math.max(disponivel, 0) : Math.max(Number(recurso.quantidade || 0), 0);
  }

  disponibilidadeLabelSala(sala: SalaEvento, recurso: Recurso): string {
    const disponivel = this.quantidadeMaximaRecursoSala(sala, recurso);
    return `${disponivel} disponível${disponivel === 1 ? '' : 'is'}`;
  }

  ajustarQuantidadeParticipantesSala(sala: SalaEvento) {
    const maxima = Math.max(Number(sala.capacidade || 1), 1);
    const quantidade = Math.floor(Number(sala.quantidadeParticipantes || 1));

    sala.quantidadeParticipantes = Math.min(Math.max(quantidade, 1), maxima);
  }

  atualizarCadeirasExtrasSala(sala: SalaEvento) {
    if (!sala.cadeirasExtras) {
      sala.quantidadeCadeiras = 0;
      return;
    }

    if (Number(sala.quantidadeCadeiras) < 1) {
      sala.quantidadeCadeiras = 1;
    }
  }

  ajustarQuantidadeCadeirasSala(sala: SalaEvento) {
    if (!sala.cadeirasExtras) {
      sala.quantidadeCadeiras = 0;
      return;
    }

    const quantidade = Math.floor(Number(sala.quantidadeCadeiras || 1));
    sala.quantidadeCadeiras = Math.max(quantidade, 1);
  }

  recursosDaSala(sala: SalaEvento) {
    return this.state.recursos.filter((recurso) => !recurso.fixo || !recurso.sala || recurso.sala === sala.nome);
  }

  atualizarDisponibilidadeRecursosSala(sala: SalaEvento) {
    this.carregarDisponibilidadeRecursosSala(sala);
    if (this.modoEdicao) this.carregarSalasDisponiveisEdicao(sala);
  }

  bloquearQuantidadeMaiorSala(event: KeyboardEvent, sala: SalaEvento, recurso: Recurso) {
    const maximo = this.quantidadeMaximaRecursoSala(sala, recurso);
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
      this.mostrarErroQuantidade(recurso.nome, maximo, sala.nome);
    }
  }

  bloquearColagemQuantidadeSala(event: ClipboardEvent, sala: SalaEvento, recurso: Recurso) {
    const maximo = this.quantidadeMaximaRecursoSala(sala, recurso);
    const texto = event.clipboardData?.getData('text') || '';

    if (!/^\d+$/.test(texto) || this.quantidadeExcedeDisponivel(texto, maximo)) {
      event.preventDefault();
      this.mostrarErroQuantidade(recurso.nome, maximo, sala.nome);
    }
  }

  validarQuantidadeRecursoSala(sala: SalaEvento, recurso: Recurso) {
    const quantidade = this.quantidadeRecursoSala(sala, recurso.id);
    const maximo = this.quantidadeMaximaRecursoSala(sala, recurso);

    if (quantidade > maximo) {
      this.mostrarErroQuantidade(recurso.nome, maximo, sala.nome);
      return;
    }

    this.limparErroQuantidade();
  }

  async agendar() {
    if (!this.validarAgendamento()) return;

    if (this.modoEdicao) {
      const sala = this.evento.salas[0];
      const confirmado = await this.feedback.confirmar(
        'Enviar substituição?',
        `Deseja substituir ${this.reservaRejeitada?.sala} por ${sala.nome} e reenviar para análise?`,
        'Enviar substituição'
      );
      if (!confirmado) return;
      this.enviarSubstituicao();
      return;
    }

    this.justificativaAgendamento = '';
    this.erroJustificativa = '';
    this.modalJustificativaAberto = true;
    this.cdr.detectChanges();
  }

  cancelarJustificativa() {
    this.modalJustificativaAberto = false;
    this.erroJustificativa = '';
    this.cdr.detectChanges();
  }

  async confirmarAgendamento() {
    this.erroJustificativa = '';

    if (!this.justificativaAgendamento.trim()) {
      this.feedback.erro('Motivo do agendamento: explique por que o evento precisa das salas selecionadas.');
      this.cdr.detectChanges();
      return;
    }

    const confirmado = await this.feedback.confirmar(
      'Confirmar evento?',
      `Deseja enviar o evento ${this.evento.nome} com ${this.evento.salas.length} sala(s) para análise?`,
      'Enviar agendamento'
    );
    if (!confirmado) return;

    this.modalJustificativaAberto = false;
    this.enviarEvento();
  }

  private validarAgendamento(): boolean {
    this.erros = [];
    if (this.evento.salas.length === 0) this.erros.push('Selecione pelo menos uma sala.');
    if (this.modoEdicao && this.evento.salas.length !== 1) {
      this.erros.push('Selecione uma sala para substituir a reserva rejeitada.');
    }
    if (!this.evento.nome) this.erros.push('Nome do evento é obrigatório.');

    this.evento.salas.forEach((sala) => {
      if (!sala.data) this.erros.push(`Data é obrigatória para ${sala.nome}.`);
      if (!sala.horaInicio || !sala.horaFim) this.erros.push(`Horário é obrigatório para ${sala.nome}.`);
      if (!sala.quantidadeParticipantes || sala.quantidadeParticipantes < 1) {
        this.erros.push(`Quantidade de participantes é obrigatória para ${sala.nome}.`);
      }
      if (sala.quantidadeParticipantes && sala.quantidadeParticipantes > sala.capacidade) {
        this.erros.push(`A sala ${sala.nome} comporta ${sala.capacidade} pessoas.`);
      }
      if (sala.cadeirasExtras && !sala.quantidadeCadeiras) this.erros.push(`Informe a quantidade de cadeiras para ${sala.nome}.`);
      if (!sala.souResponsavel && !sala.responsavel) this.erros.push(`Nome do responsável é obrigatório para ${sala.nome}.`);
      sala.recursos.forEach((recursoId) => {
        const quantidade = this.quantidadeRecursoSala(sala, recursoId);
        const recurso = this.state.recursos.find((item) => item.id === recursoId);

        if (quantidade < 1) {
          this.erros.push(`Informe uma quantidade válida para os recursos de ${sala.nome}.`);
        }

        if (recurso && quantidade > this.quantidadeMaximaRecursoSala(sala, recurso)) {
          this.erros.push(`Não é possível reservar ${quantidade} unidade(s) de ${recurso.nome} em ${sala.nome}. Existem somente ${this.quantidadeMaximaRecursoSala(sala, recurso)} disponível(is) nesse horário.`);
        }
      });
    });

    if (this.erros.length > 0) {
      this.feedback.erro(this.erros);
      this.cdr.detectChanges();
      return false;
    }

    return true;
  }

  private enviarEvento() {
    const primeiraSala = this.evento.salas[0];
    const payload = {
      nome: this.evento.nome,
      descricao: this.evento.observacoes,
      justificativa: this.justificativaAgendamento.trim(),
      inicio: `${primeiraSala.data}T${primeiraSala.horaInicio}:00`,
      fim: `${primeiraSala.data}T${primeiraSala.horaFim}:00`,
      salas: this.evento.salas.map((sala) => ({
        salaId: sala.id,
        inicio: `${sala.data}T${sala.horaInicio}:00`,
        fim: `${sala.data}T${sala.horaFim}:00`,
        quantidadeParticipantes: Number(sala.quantidadeParticipantes),
        recursos: sala.recursos.map((recursoId) => ({
          recursoId,
          quantidade: this.quantidadeRecursoSala(sala, recursoId)
        })),
        justificativa: this.justificativaAgendamento.trim(),
        motivoAgendamento: this.justificativaAgendamento.trim(),
        cadeirasExtras: Boolean(sala.cadeirasExtras),
        quantidadeCadeiras: sala.cadeirasExtras ? Number(sala.quantidadeCadeiras) : 0,
        responsavel: sala.souResponsavel ? null : sala.responsavel.trim(),
        nomeResponsavel: sala.souResponsavel ? null : sala.responsavel.trim()
      }))
    };

    this.api.criarEvento(payload).subscribe({
      next: () => {
        this.state.limparReservas();
        this.api.listarMinhasReservas().subscribe({
          next: (reservas) => this.state.setReservas(reservas),
          error: () => {}
        });
        this.evento = { salaSelecionadaId: null, salas: [], salaAtivaId: null, nome: '', observacoes: '' };
        this.justificativaAgendamento = '';
        this.feedback.sucesso('Evento registrado e enviado para análise.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(this.feedback.mensagemErro(err, 'Não foi possível registrar o evento.'));
        this.cdr.detectChanges();
      }
    });
  }

  private enviarSubstituicao() {
    const reservaRejeitada = this.reservaRejeitada;
    const sala = this.evento.salas[0];

    if (!reservaRejeitada || !sala) return;

    const payload = {
      salaId: sala.id,
      inicio: `${sala.data}T${sala.horaInicio}:00`,
      fim: `${sala.data}T${sala.horaFim}:00`,
      quantidadeParticipantes: Number(sala.quantidadeParticipantes),
      recursos: sala.recursos.map((recursoId) => ({
        recursoId,
        quantidade: this.quantidadeRecursoSala(sala, recursoId)
      })),
      cadeirasExtras: Boolean(sala.cadeirasExtras),
      quantidadeCadeiras: sala.cadeirasExtras ? Number(sala.quantidadeCadeiras) : 0,
      responsavel: sala.souResponsavel ? null : sala.responsavel.trim(),
      nomeResponsavel: sala.souResponsavel ? null : sala.responsavel.trim()
    };

    this.api.substituirReservaEvento(reservaRejeitada.id, payload).subscribe({
      next: () => {
        sessionStorage.removeItem('stipz_edicao_evento');
        this.contextoEdicao = null;
        this.feedback.sucesso('Sala substituída. A nova reserva voltou para análise do administrador.');
        this.router.navigateByUrl('/agendamentos');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(
          this.feedback.mensagemErro(err, 'Não foi possível substituir a sala rejeitada.')
        );
        this.cdr.detectChanges();
      }
    });
  }

  private carregarContextoEdicao() {
    const reservaId = Number(this.route.snapshot.queryParamMap.get('editarReserva'));
    const armazenado = sessionStorage.getItem('stipz_edicao_evento');

    if (!reservaId || !armazenado) return;

    try {
      const contexto = JSON.parse(armazenado) as EdicaoEventoContexto;

      if (contexto.reservaRejeitada?.id !== reservaId) {
        sessionStorage.removeItem('stipz_edicao_evento');
        return;
      }

      this.contextoEdicao = contexto;
      this.evento.nome = contexto.evento;
      this.evento.observacoes = contexto.observacoes;
      this.justificativaAgendamento = contexto.justificativa;
    } catch {
      sessionStorage.removeItem('stipz_edicao_evento');
    }
  }

  private inicializarModoEdicao() {
    if (!this.contextoEdicao || this.edicaoInicializada) return;

    this.edicaoInicializada = true;
    this.evento.salas = [];
    this.evento.salaAtivaId = null;
    this.evento.salaSelecionadaId = null;
  }

  private criarConfiguracaoSala(sala: Sala): SalaEvento {
    const rejeitada = this.reservaRejeitada;
    const responsavelSolicitante = Boolean(
      rejeitada?.responsavel &&
      rejeitada?.solicitante &&
      rejeitada.responsavel === rejeitada.solicitante
    );

    return {
      ...sala,
      data: this.modoEdicao ? rejeitada?.data || '' : '',
      horaInicio: this.modoEdicao ? rejeitada?.horaInicio || '' : '',
      horaFim: this.modoEdicao ? rejeitada?.horaFim || '' : '',
      quantidadeParticipantes: null,
      recursos: [],
      recursoQuantidades: {},
      cadeirasExtras: false,
      quantidadeCadeiras: 0,
      souResponsavel: this.modoEdicao ? responsavelSolicitante : true,
      responsavel: this.modoEdicao && !responsavelSolicitante ? rejeitada?.responsavel || '' : ''
    };
  }

  private carregarSalasDisponiveisEdicao(sala?: SalaEvento) {
    if (!this.modoEdicao) return;

    const rejeitada = this.reservaRejeitada;
    const data = sala?.data || rejeitada?.data;
    const inicio = sala?.horaInicio || rejeitada?.horaInicio;
    const fim = sala?.horaFim || rejeitada?.horaFim;

    if (!data || !inicio || !fim) return;

    this.api.listarSalasDisponiveis(
      `${data}T${inicio}:00`,
      `${data}T${fim}:00`
    ).subscribe({
      next: (salas) => {
        this.salasDisponiveisEdicao = (salas || []).map((item: any) => ({
          id: Number(item.id),
          nome: item.nome || item.nomeSala || '',
          capacidade: Number(item.capacidade || 0)
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.salasDisponiveisEdicao = null;
      }
    });
  }

  private periodoSalaCompleto(sala: SalaEvento): boolean {
    return Boolean(sala.id && sala.data && sala.horaInicio && sala.horaFim);
  }

  private carregarDisponibilidadeRecursosSala(sala: SalaEvento) {
    if (!this.periodoSalaCompleto(sala)) return;

    this.api.listarDisponibilidadeRecursos({
      salaId: sala.id,
      inicio: `${sala.data}T${sala.horaInicio}:00`,
      fim: `${sala.data}T${sala.horaFim}:00`
    }).subscribe({
      next: (recursos) => {
        this.disponibilidadePorSala[sala.id] = {};

        (recursos || []).forEach((recurso: any) => {
          this.disponibilidadePorSala[sala.id][Number(recurso.id)] = Number(recurso.quantidadeDisponivel ?? recurso.disponivel ?? recurso.quantidade ?? 0);
        });

        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private quantidadeExcedeDisponivel(valor: string, maximo: number): boolean {
    if (!valor) return false;
    return Number(valor) > maximo || valor.length > String(Math.max(maximo, 1)).length;
  }

  private mostrarErroQuantidade(nomeRecurso: string, maximo: number, nomeSala: string) {
    const mensagem = `Existem somente ${maximo} unidade(s) de ${nomeRecurso} disponível(is) em ${nomeSala} nesse horário.`;
    this.erros = [mensagem];
    this.feedback.erro(`${nomeRecurso}: ${mensagem}`);
    this.cdr.detectChanges();
  }

  private limparErroQuantidade() {
    this.erros = this.erros.filter((erro) => !erro.includes('disponível(is)'));
    this.cdr.detectChanges();
  }
}
