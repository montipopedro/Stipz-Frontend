import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../services/api';
import { Reserva, StipzStateService } from '../services/stipz-state';
import { SincronizacaoService } from '../services/sincronizacao';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-cancelar-reserva',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cancelar-reserva.html',
  styleUrls: ['./cancelar-reserva.css']
})
export class CancelarReservaComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  selecionada?: Reserva;

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
    this.state.limparReservas();

    this.api.listarMinhasReservas().subscribe({
      next: (reservas) => {
        this.state.setReservas(reservas);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get reservasCancelaveis() {
    return this.state.reservas.filter((reserva) => reserva.status?.toUpperCase() === 'PENDENTE');
  }

  selecionar(reserva: Reserva) {
    this.selecionada = reserva;
  }

  async abrirConfirmacao() {
    if (!this.selecionada) return;
    const reserva = this.selecionada;
    const confirmado = await this.feedback.confirmar(
      'Cancelar reserva?',
      `Deseja cancelar a reserva da sala ${reserva.sala} em ${reserva.data}?`,
      'Cancelar reserva',
      'Manter reserva',
      true
    );
    if (confirmado) this.cancelar(reserva);
  }

  cancelar(reserva: Reserva) {
    const id = reserva.id;
    this.api.cancelarReserva(id).subscribe({
      next: () => {
        this.state.cancelarReserva(id);
        this.selecionada = undefined;
        this.feedback.sucesso('Reserva cancelada com sucesso.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(this.feedback.mensagemErro(err, 'Não foi possível cancelar a reserva.'));
        this.cdr.detectChanges();
      }
    });
  }
}
