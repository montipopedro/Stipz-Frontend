import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SincronizacaoService {
  private alteracaoSubject = new Subject<void>();
  alteracao$ = this.alteracaoSubject.asObservable();

  notificarAlteracao(): void {
    this.alteracaoSubject.next();
  }
}
