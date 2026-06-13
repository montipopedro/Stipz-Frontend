import { Injectable } from '@angular/core';

type Tema = 'claro' | 'escuro';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly chaveTema = 'stipz_tema';
  temaAtual: Tema = this.lerTemaSalvo();

  constructor() {
    this.aplicarTema(this.temaAtual);
  }

  get modoEscuro(): boolean {
    return this.temaAtual === 'escuro';
  }

  alternarTema(): void {
    this.temaAtual = this.modoEscuro ? 'claro' : 'escuro';
    localStorage.setItem(this.chaveTema, this.temaAtual);
    this.aplicarTema(this.temaAtual);
  }

  private lerTemaSalvo(): Tema {
    return localStorage.getItem(this.chaveTema) === 'escuro' ? 'escuro' : 'claro';
  }

  private aplicarTema(tema: Tema): void {
    document.body.classList.toggle('dark-mode', tema === 'escuro');
  }
}
