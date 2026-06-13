import { Injectable } from '@angular/core';

export type ReservaStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'REJEITADA' | 'CANCELADA';

export interface Sala {
  id: number;
  nome: string;
  capacidade: number;
}

export interface Recurso {
  id: number;
  sala: string;
  nome: string;
  descricao: string;
  quantidade: number;
  quantidadeReservada?: number;
  quantidadeDisponivel?: number;
  tipo: string;
  fixo: boolean;
}

export interface Reserva {
  id: number;
  usuarioId?: number;
  salaId?: number;
  solicitante: string;
  sala: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  recursos: string[];
  responsavel: string;
  status: ReservaStatus;
  ehEvento?: boolean;
  eventoId?: number;
  evento?: string;
  eventoDescricao?: string;
  observacoes?: string;
  justificativa?: string;
  motivoRejeicao?: string;
  cadeirasExtras: boolean;
  quantidadeCadeiras: number;
  recursosDetalhes?: Array<{
    id?: number;
    nome: string;
    quantidade: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class StipzStateService {
  salas: Sala[] = [
    { id: 1, nome: 'Sala 01', capacidade: 30 },
    { id: 2, nome: 'Sala de informática 04', capacidade: 40 },
    { id: 3, nome: 'Auditório', capacidade: 120 }
  ];

  recursos: Recurso[] = [
    { id: 1, sala: 'Sala 01', nome: 'Caixa de som', descricao: '', quantidade: 1, tipo: 'Audiovisual', fixo: false },
    { id: 2, sala: 'Sala 01', nome: 'Água mineral', descricao: '', quantidade: 10, tipo: 'Apoio', fixo: false },
    { id: 3, sala: 'Sala de informática 04', nome: 'Projetor', descricao: '', quantidade: 1, tipo: 'Informática', fixo: true }
  ];

  reservas: Reserva[] = [
    {
      id: 1,
      solicitante: 'Murillo Gabriel Moresco',
      sala: 'Sala 01',
      data: '2050-08-15',
      horaInicio: '19:10',
      horaFim: '20:50',
      recursos: ['Caixa de som'],
      responsavel: 'Murillo Gabriel Moresco',
      cadeirasExtras: false,
      quantidadeCadeiras: 0,
      status: 'APROVADA'
    },
    {
      id: 2,
      solicitante: 'Pedro Henrique',
      sala: 'Sala de informática 04',
      data: '2025-08-20',
      horaInicio: '21:00',
      horaFim: '22:40',
      recursos: ['Projetor'],
      responsavel: 'Pedro Henrique',
      cadeirasExtras: false,
      quantidadeCadeiras: 0,
      status: 'PENDENTE'
    }
  ];

  get tiposRecurso(): string[] {
    return Array.from(new Set(this.recursos.map((recurso) => recurso.tipo))).sort();
  }

  limparReservas(): void {
    this.reservas = [];
  }

  limparTudo(): void {
    this.salas = [];
    this.recursos = [];
    this.reservas = [];
  }

  setSalas(salas: any[]): void {
    this.salas = (salas || []).map((sala) => ({
      id: sala.id,
      nome: sala.nome || sala.nomeSala || sala.descricao || '',
      capacidade: Number(sala.capacidade || sala.quantidade || 0)
    }));
  }

  setRecursos(recursos: any[]): void {
    const recursosAtuais = new Map(this.recursos.map((recurso) => [Number(recurso.id), recurso]));

    this.recursos = (recursos || []).map((recurso) => {
      const anterior = recursosAtuais.get(Number(recurso.id));

      return {
        id: recurso.id,
        sala: recurso.sala?.nome || recurso.sala || recurso.nomeSala || anterior?.sala || '',
        nome: recurso.nome || recurso.nomeRecurso || anterior?.nome || '',
        descricao: recurso.descricao ||
          recurso.tipoRecurso?.descricao ||
          recurso.tipoRecurso?.nome ||
          anterior?.descricao ||
          '',
        quantidade: Number(recurso.quantidade ?? anterior?.quantidade ?? 0),
        quantidadeReservada: Number(recurso.quantidadeReservada || recurso.reservado || recurso.reservados || 0),
        quantidadeDisponivel: recurso.quantidadeDisponivel !== undefined || recurso.disponivel !== undefined
          ? Number(recurso.quantidadeDisponivel ?? recurso.disponivel)
          : anterior?.quantidadeDisponivel,
        tipo: recurso.categoria ||
          recurso.tipoRecurso?.categoria ||
          recurso.tipo?.categoria ||
          recurso.tipo?.nome ||
          recurso.tipo ||
          (typeof recurso.tipoRecurso === 'string' ? recurso.tipoRecurso : '') ||
          anterior?.tipo ||
          '',
        fixo: Boolean(recurso.fixo ?? anterior?.fixo)
      };
    });
  }

  setReservas(reservas: any[]): void {
    this.reservas = (reservas || []).map((reserva) => ({
      id: reserva.id,
      usuarioId: reserva.usuarioId || reserva.idUsuario || reserva.usuario?.id,
      salaId: reserva.salaId || reserva.idSala || reserva.sala?.id,
      solicitante: reserva.solicitante ||
        reserva.nomeSolicitante ||
        reserva.usuarioSolicitante ||
        reserva.usuario?.nome ||
        reserva.usuario?.name ||
        '',
      sala: reserva.sala?.nome || reserva.sala || reserva.nomeSala || '',
      data: this.extrairData(reserva.dataInicio || reserva.inicio || reserva.data || reserva.dataReserva || reserva.dia),
      horaInicio: this.extrairHora(reserva.dataInicio || reserva.inicio || reserva.horaInicio || reserva.horarioInicio),
      horaFim: this.extrairHora(reserva.dataFim || reserva.fim || reserva.horaFim || reserva.horarioFim),
      recursos: Array.isArray(reserva.recursos)
        ? reserva.recursos.map((recurso: any) => this.formatarRecursoReserva(recurso))
        : [],
      responsavel: reserva.responsavel ||
        reserva.nomeResponsavel ||
        reserva.responsavelReserva ||
        reserva.nomeDoResponsavel ||
        reserva.usuario?.nome ||
        reserva.usuario?.name ||
        '',
      status: reserva.status || 'PENDENTE',
      ehEvento: Boolean(reserva.evento || reserva.nomeEvento || reserva.eventoId || reserva.idEvento),
      eventoId: Number(reserva.eventoId || reserva.idEvento || reserva.evento?.id || 0) || undefined,
      evento: reserva.evento?.nome || reserva.evento || reserva.nomeEvento,
      eventoDescricao: reserva.eventoDescricao || reserva.evento?.descricao,
      observacoes: reserva.observacoes || reserva.descricao || reserva.eventoDescricao || reserva.evento?.descricao,
      justificativa: this.extrairJustificativa(reserva),
      motivoRejeicao: this.extrairMotivoRejeicao(reserva),
      cadeirasExtras: Boolean(
        reserva.cadeirasExtras ??
        reserva.possuiCadeirasExtras ??
        reserva.eventoSala?.cadeirasExtras
      ),
      quantidadeCadeiras: Number(
        reserva.quantidadeCadeiras ??
        reserva.cadeirasAdicionais ??
        reserva.quantidadeCadeirasExtras ??
        reserva.eventoSala?.quantidadeCadeiras ??
        0
      ),
      recursosDetalhes: Array.isArray(reserva.recursos)
        ? reserva.recursos.map((recurso: any) => ({
            id: Number(recurso.id || recurso.recursoId || recurso.recurso?.id || 0) || undefined,
            nome: recurso.nome || recurso.recurso?.nome || recurso.recurso || '',
            quantidade: Number(recurso.quantidade || 1)
          }))
        : []
    }));
  }

  private extrairData(valor: string): string {
    return valor?.includes('T') ? valor.split('T')[0] : valor || '';
  }

  private extrairHora(valor: string): string {
    if (!valor) return '';
    const hora = valor.includes('T') ? valor.split('T')[1] : valor;
    return hora?.slice(0, 5) || '';
  }

  adicionarSala(sala: Omit<Sala, 'id'>): void {
    this.salas.push({ ...sala, id: Date.now() });
  }

  adicionarRecurso(recurso: Omit<Recurso, 'id'>): void {
    this.recursos.push({ ...recurso, id: Date.now() });
  }

  quantidadeReservadaRecurso(recurso: Recurso): number {
    if (recurso.quantidadeReservada !== undefined && recurso.quantidadeReservada > 0) {
      return recurso.quantidadeReservada;
    }

    return this.reservas
      .filter((reserva) => ['PENDENTE', 'APROVADA'].includes(String(reserva.status).toUpperCase()))
      .reduce((total, reserva) => {
        return total + reserva.recursos.reduce((subtotal, item) => {
          return subtotal + this.quantidadeDoItemRecurso(item, recurso.nome);
        }, 0);
      }, 0);
  }

  quantidadeDisponivelRecurso(recurso: Recurso): number {
    if (recurso.quantidadeDisponivel !== undefined) {
      return recurso.quantidadeDisponivel;
    }

    return Math.max(Number(recurso.quantidade || 0) - this.quantidadeReservadaRecurso(recurso), 0);
  }

  adicionarReserva(reserva: Omit<Reserva, 'id' | 'status'>): Reserva {
    const novaReserva: Reserva = { ...reserva, id: Date.now(), status: 'PENDENTE' };
    this.reservas.push(novaReserva);
    return novaReserva;
  }

  cancelarReserva(id: number): void {
    const reserva = this.reservas.find((item) => item.id === id);
    if (reserva) {
      reserva.status = 'CANCELADA';
    }
  }

  atualizarStatus(id: number, status: ReservaStatus): void {
    const reserva = this.reservas.find((item) => item.id === id);
    if (reserva) {
      reserva.status = status;
    }
  }

  registrarRejeicao(id: number, motivo: string): void {
    const reserva = this.reservas.find((item) => item.id === id);
    if (reserva) {
      reserva.status = 'REJEITADA';
      reserva.motivoRejeicao = motivo;
    }
  }

  private extrairJustificativa(reserva: any): string {
    return reserva.justificativa ||
      reserva.motivoAgendamento ||
      reserva.justificativaAgendamento ||
      reserva.motivoReserva ||
      reserva.evento?.justificativa ||
      reserva.evento?.motivo ||
      reserva.evento?.motivoAgendamento ||
      '';
  }

  private extrairMotivoRejeicao(reserva: any): string {
    return reserva.motivoRejeicao ||
      reserva.justificativaRejeicao ||
      reserva.motivoRecusa ||
      reserva.motivoReprovacao ||
      reserva.rejeicao?.motivo ||
      reserva.evento?.motivoRejeicao ||
      '';
  }

  private formatarRecursoReserva(recurso: any): string {
    if (typeof recurso === 'string') return recurso;

    const nome = recurso.nome || recurso.recurso?.nome || recurso.recurso || recurso.nomeRecurso || '';
    const quantidade = Number(recurso.quantidade || recurso.qtd || 0);

    return quantidade > 0 ? `${nome} x${quantidade}` : nome;
  }

  private quantidadeDoItemRecurso(item: string, nomeRecurso: string): number {
    const nomeNormalizado = nomeRecurso.trim().toLowerCase();
    const itemNormalizado = String(item || '').trim().toLowerCase();

    if (!itemNormalizado.startsWith(nomeNormalizado)) return 0;

    const match = itemNormalizado.match(/\sx(\d+)$/);
    return match ? Number(match[1]) : 1;
  }
}
