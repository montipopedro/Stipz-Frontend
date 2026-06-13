import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject, catchError, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from './api';
import { StipzStateService } from './stipz-state';

export type PerfilUsuario = 'ADMIN' | 'COMUM';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly chaveBoasVindas = 'stipz_mostrar_boas_vindas';
  private usuarioSubject = new BehaviorSubject<any>(this.lerUsuarioSalvo());
  private boasVindasSubject = new Subject<void>();
  usuario$ = this.usuarioSubject.asObservable();
  boasVindas$ = this.boasVindasSubject.asObservable();

  constructor(private api: ApiService, private router: Router, private state: StipzStateService) {}

  login(credenciais: any): Observable<any> {
    this.state.limparTudo();

    return this.api.login(credenciais).pipe(
      switchMap((resposta) => {
        const usuarioDaResposta = this.extrairUsuario(resposta);
        if (usuarioDaResposta) {
          this.salvarUsuario(usuarioDaResposta);
          return of(usuarioDaResposta);
        }

        return this.carregarUsuario().pipe(
          map((usuario) => usuario || resposta)
        );
      })
    );
  }

  carregarUsuario(): Observable<any> {
    if (!this.temToken()) {
      return of(this.usuarioSubject.value);
    }

    return this.api.me().pipe(
      tap((usuario) => this.salvarUsuario(usuario)),
      catchError(() => of(this.usuarioSubject.value))
    );
  }

  logout(): void {
    this.state.limparTudo();
    sessionStorage.removeItem('stipz_token');
    sessionStorage.removeItem('stipz_usuario');
    sessionStorage.removeItem(this.chaveBoasVindas);
    localStorage.removeItem('stipz_token');
    localStorage.removeItem('stipz_usuario');
    this.usuarioSubject.next(null);
    this.router.navigateByUrl('/login');
  }

  temToken(): boolean {
    return !!sessionStorage.getItem('stipz_token');
  }

  temSessao(): boolean {
    return this.temToken() || !!this.usuarioAtual;
  }

  get usuarioAtual(): any {
    return this.usuarioSubject.value;
  }

  get perfilAtual(): PerfilUsuario {
    return this.normalizarPerfil(this.usuarioAtual);
  }

  isAdmin(): boolean {
    return this.perfilAtual === 'ADMIN';
  }

  podeAcessar(perfisPermitidos?: PerfilUsuario[]): boolean {
    if (!perfisPermitidos || perfisPermitidos.length === 0) {
      return this.temSessao();
    }

    return perfisPermitidos.includes(this.perfilAtual);
  }

  marcarBoasVindas(): void {
    sessionStorage.setItem(this.chaveBoasVindas, '1');
    this.boasVindasSubject.next();
  }

  consumirBoasVindas(): boolean {
    const deveMostrar = sessionStorage.getItem(this.chaveBoasVindas) === '1';
    sessionStorage.removeItem(this.chaveBoasVindas);
    return deveMostrar;
  }

  private salvarUsuario(usuario: any): void {
    const usuarioNormalizado = {
      ...usuario,
      perfil: this.normalizarPerfil(usuario)
    };

    sessionStorage.setItem('stipz_usuario', JSON.stringify(usuarioNormalizado));
    localStorage.removeItem('stipz_usuario');
    this.usuarioSubject.next(usuarioNormalizado);
  }

  private lerUsuarioSalvo(): any {
    const usuario = sessionStorage.getItem('stipz_usuario');
    if (!usuario) return null;

    try {
      return JSON.parse(usuario);
    } catch {
      return null;
    }
  }

  private extrairUsuario(resposta: any): any {
    const usuario =
      resposta?.usuario ||
      resposta?.user ||
      resposta?.data?.usuario ||
      resposta?.data?.user;

    if (usuario) {
      return usuario;
    }

    if (resposta?.perfil || resposta?.role || resposta?.tipo || resposta?.authorities || resposta?.roles) {
      return resposta;
    }

    return null;
  }

  private normalizarPerfil(usuario: any): PerfilUsuario {
    const valor =
      usuario?.perfil ||
      usuario?.role ||
      usuario?.tipo ||
      usuario?.authority ||
      usuario?.authorities?.[0]?.authority ||
      usuario?.authorities?.[0] ||
      usuario?.roles?.[0]?.name ||
      usuario?.roles?.[0] ||
      '';

    const perfil = String(valor).toUpperCase();
    return perfil.includes('ADMIN') || perfil.includes('ADMINISTRADOR') ? 'ADMIN' : 'COMUM';
  }
}
