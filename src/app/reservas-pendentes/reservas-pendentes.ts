import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-reservas-pendentes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservas-pendentes.html',
  styleUrls: ['./reservas-pendentes.css']
})
export class ReservasPendentesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  processandoId?: number;
  reservaParaRejeitar?: Reserva;
  motivoRejeicao = '';
  erroMotivoRejeicao = '';

  constructor(
    public state: StipzStateService,
    private api: ApiService,
    private sincronizacao: SincronizacaoService,
    private cdr: ChangeDetectorRef,
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
    this.api.listarReservas().subscribe({
      next: (reservas) => {
        this.state.setReservas(reservas);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get pendentes() {
    return this.state.reservas.filter((reserva) => reserva.status?.toUpperCase() === 'PENDENTE');
  }

  get gruposPendentes(): GrupoReservas[] {
    return this.agruparReservas(this.pendentes);
  }

  async aprovar(reserva: Reserva) {
    const confirmado = await this.feedback.confirmar(
      'Aprovar reserva?',
      `Confirma a aprovação de ${reserva.sala}, solicitada por ${reserva.solicitante}?`,
      'Aprovar'
    );
    if (!confirmado) return;
    this.alterarStatus(reserva, 'aprovar');
  }

  rejeitar(reserva: Reserva) {
    this.erroMotivoRejeicao = '';
    this.motivoRejeicao = '';
    this.reservaParaRejeitar = reserva;
    this.cdr.detectChanges();
  }

  cancelarRejeicao() {
    this.reservaParaRejeitar = undefined;
    this.motivoRejeicao = '';
    this.erroMotivoRejeicao = '';
    this.cdr.detectChanges();
  }

  confirmarRejeicao() {
    const motivo = this.motivoRejeicao.trim();

    if (!motivo) {
      this.feedback.erro('Motivo da rejeição: explique por que a reserva será rejeitada.');
      this.cdr.detectChanges();
      return;
    }

    if (this.reservaParaRejeitar) {
      this.alterarStatus(this.reservaParaRejeitar, 'rejeitar', motivo);
    }
  }

  private alterarStatus(reserva: Reserva, acao: 'aprovar' | 'rejeitar', motivoRejeicao = '') {
    const id = Number(reserva.id);
    if (!Number.isFinite(id) || id <= 0) {
      this.feedback.erro('Reserva: não foi possível identificar a reserva selecionada.');
      this.cdr.detectChanges();
      return;
    }

    this.processandoId = reserva.id;

    const requisicao = acao === 'aprovar'
      ? this.api.aprovarReserva(id)
      : this.api.rejeitarReserva(id, motivoRejeicao);

    requisicao.subscribe({
      next: () => {
        if (acao === 'aprovar') {
          this.state.atualizarStatus(reserva.id, 'APROVADA');
        } else {
          this.state.registrarRejeicao(reserva.id, motivoRejeicao);
        }

        this.feedback.sucesso(
          acao === 'aprovar' ? 'Reserva aprovada com sucesso.' : 'Reserva rejeitada com sucesso.'
        );
        this.processandoId = undefined;
        this.reservaParaRejeitar = undefined;
        this.motivoRejeicao = '';
        this.erroMotivoRejeicao = '';
        this.carregarReservas();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(
          this.feedback.mensagemErro(
            err,
            acao === 'aprovar'
              ? 'Não foi possível aprovar a reserva.'
              : 'Não foi possível rejeitar a reserva.'
          )
        );
        this.processandoId = undefined;
        this.cdr.detectChanges();
      }
    });
  }

  private agruparReservas(reservas: Reserva[]): GrupoReservas[] {
    const grupos = new Map<string, GrupoReservas>();

    reservas.forEach((reserva) => {
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
}
