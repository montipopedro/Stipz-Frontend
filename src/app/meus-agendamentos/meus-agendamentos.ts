import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../services/api';
import { Reserva, StipzStateService } from '../services/stipz-state';
import { SincronizacaoService } from '../services/sincronizacao';
import { FeedbackService } from '../services/feedback';

interface GrupoReservas {
  chave: string;
  evento?: string;
  reservas: Reserva[];
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
  selector: 'app-meus-agendamentos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meus-agendamentos.html',
  styleUrls: ['./meus-agendamentos.css']
})
export class MeusAgendamentosComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    public state: StipzStateService,
    private api: ApiService,
    private sincronizacao: SincronizacaoService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private feedback: FeedbackService
  ) {}

  ngOnInit() {
    this.carregarReservas();

    this.sincronizacao.alteracao$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.carregarReservas());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregarReservas() {
    this.state.limparReservas();

    this.api.listarMinhasReservas().subscribe({
      next: (reservas) => {
        this.state.setReservas(reservas);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get reservasVisiveis() {
    return this.state.reservas;
  }

  get gruposReservas(): GrupoReservas[] {
    const grupos = new Map<string, GrupoReservas>();

    this.reservasVisiveis.forEach((reserva) => {
      const chave = reserva.ehEvento
        ? `evento-${reserva.eventoId || reserva.evento || reserva.id}`
        : `reserva-${reserva.id}`;

      const grupo = grupos.get(chave) || {
        chave,
        evento: reserva.ehEvento ? reserva.evento : undefined,
        reservas: []
      };

      grupo.reservas.push(reserva);
      grupos.set(chave, grupo);
    });

    return Array.from(grupos.values());
  }

  podeEditarReservaEvento(reserva: Reserva): boolean {
    return Boolean(
      reserva.ehEvento &&
      reserva.eventoId &&
      ['REJEITADA', 'RECUSADA'].includes(String(reserva.status).toUpperCase())
    );
  }

  async solicitarEdicao(grupo: GrupoReservas, reserva: Reserva) {
    if (!reserva.eventoId) return;

    const confirmado = await this.feedback.confirmar(
      'Editar sala rejeitada?',
      `Deseja substituir a reserva de ${reserva.sala}? As salas já aprovadas não serão alteradas.`,
      'Editar reserva'
    );
    if (!confirmado) return;

    const contexto: EdicaoEventoContexto = {
      eventoId: reserva.eventoId,
      evento: reserva.evento || grupo.evento || 'Evento',
      observacoes: reserva.eventoDescricao || reserva.observacoes || '',
      justificativa: reserva.justificativa || '',
      salasAprovadas: grupo.reservas.filter(
        (item) => String(item.status).toUpperCase() === 'APROVADA'
      ),
      reservaRejeitada: reserva
    };

    sessionStorage.setItem('stipz_edicao_evento', JSON.stringify(contexto));
    this.router.navigate(['/evento'], {
      queryParams: { editarReserva: contexto.reservaRejeitada.id }
    });
  }
}
