import { Injectable, NgZone } from '@angular/core';
import { rotas } from './api';
import { SincronizacaoService } from './sincronizacao';

@Injectable({
  providedIn: 'root'
})
export class NotificacoesService {
  private eventSource?: EventSource;
  private ultimoToken?: string;

  constructor(private zone: NgZone, private sincronizacao: SincronizacaoService) {}

  conectar(): void {
    const token = sessionStorage.getItem('stipz_token');
    if (!token) {
      this.desconectar();
      return;
    }

    if (this.eventSource && this.ultimoToken === token) {
      return;
    }

    this.desconectar();
    this.ultimoToken = token;
    this.eventSource = new EventSource(rotas.notificacoes.stream(token));

    this.eventSource.addEventListener('alteracao', () => {
      this.zone.run(() => {
        this.sincronizacao.notificarAlteracao();
      });
    });

    this.eventSource.onerror = () => {
      if (!sessionStorage.getItem('stipz_token')) {
        this.desconectar();
      }
    };
  }

  desconectar(): void {
    this.eventSource?.close();
    this.eventSource = undefined;
    this.ultimoToken = undefined;
  }

}
