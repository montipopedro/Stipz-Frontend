import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const API_URL = 'http://localhost:8080';

export const rotas = {
  auth: {
    login: `${API_URL}/auth/login`,
    me: `${API_URL}/auth/me`,
    regrasAcesso: `${API_URL}/auth/regras-acesso`,
  },

  usuarios: {
    criar: `${API_URL}/usuarios`,
    listar: `${API_URL}/usuarios`,
    buscarPorId: (id: number) => `${API_URL}/usuarios/${id}`,
    deletar: (id: number) => `${API_URL}/usuarios/${id}`,
  },

  salas: {
    criar: `${API_URL}/salas`,
    listar: `${API_URL}/salas`,
    buscarPorId: (id: number) => `${API_URL}/salas/${id}`,
    deletar: (id: number) => `${API_URL}/salas/${id}`,
    disponiveis: `${API_URL}/salas/disponiveis`,
  },

  recursos: {
    criar: `${API_URL}/recursos`,
    listar: `${API_URL}/recursos`,
    disponibilidade: `${API_URL}/recursos/disponibilidade`,
  },

  reservas: {
    criar: `${API_URL}/reservas`,
    listar: `${API_URL}/reservas`,
    minhas: `${API_URL}/reservas/minhas`,
    aprovar: (id: number) => `${API_URL}/reservas/${id}/aprovar`,
    rejeitar: (id: number) => `${API_URL}/reservas/${id}/rejeitar`,
    cancelar: (id: number) => `${API_URL}/reservas/${id}/cancelar`,
    substituir: (id: number) => `${API_URL}/reservas/${id}/substituir`,
  },

  eventos: {
    criar: `${API_URL}/eventos`,
    listar: `${API_URL}/eventos`,
  },

  notificacoes: {
    stream: (token: string) => `${API_URL}/notificacoes/stream?token=${encodeURIComponent(token)}`,
  },
};

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) {}

  private get httpOptions() {
    const token = sessionStorage.getItem('stipz_token');
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  private salvarToken(resposta: any): void {
    const token = typeof resposta === 'string'
      ? resposta
      : resposta?.token || resposta?.accessToken || resposta?.jwt;

    if (token) {
      sessionStorage.setItem('stipz_token', token);
      localStorage.removeItem('stipz_token');
    }
  }

  listarUsuarios(): Observable<any> {
    return this.http.get(rotas.usuarios.listar, this.httpOptions);
  }

  criarUsuario(usuario: any): Observable<any> {
    return this.http.post(rotas.usuarios.criar, usuario, this.httpOptions);
  }

  login(credenciais: any): Observable<any> {
    return this.http.post(rotas.auth.login, credenciais).pipe(
      tap((resposta) => this.salvarToken(resposta))
    );
  }

  me(): Observable<any> {
    return this.http.get(rotas.auth.me, this.httpOptions);
  }

  regrasAcesso(): Observable<any> {
    return this.http.get(rotas.auth.regrasAcesso, this.httpOptions);
  }

  listarSalas(): Observable<any> {
    return this.http.get(rotas.salas.listar, this.httpOptions);
  }

  listarSalasDisponiveis(inicio: string, fim: string): Observable<any> {
    const params = new URLSearchParams({ inicio, fim });
    return this.http.get(`${rotas.salas.disponiveis}?${params.toString()}`, this.httpOptions);
  }

  criarSala(sala: any): Observable<any> {
    return this.http.post(rotas.salas.criar, sala, this.httpOptions);
  }

  listarRecursos(): Observable<any> {
    return this.http.get(rotas.recursos.listar, this.httpOptions);
  }

  listarDisponibilidadeRecursos(filtros: { salaId?: number | null; inicio?: string; fim?: string }): Observable<any> {
    const params = new URLSearchParams();

    if (filtros.salaId) params.set('salaId', String(filtros.salaId));
    if (filtros.inicio) params.set('inicio', filtros.inicio);
    if (filtros.fim) params.set('fim', filtros.fim);

    const query = params.toString();
    const url = query ? `${rotas.recursos.disponibilidade}?${query}` : rotas.recursos.disponibilidade;

    return this.http.get(url, this.httpOptions);
  }

  criarRecurso(recurso: any): Observable<any> {
    return this.http.post(rotas.recursos.criar, recurso, this.httpOptions);
  }

  listarReservas(): Observable<any> {
    return this.http.get(rotas.reservas.listar, this.httpOptions);
  }

  listarMinhasReservas(): Observable<any> {
    return this.http.get(rotas.reservas.minhas, this.httpOptions);
  }

  criarReserva(reserva: any): Observable<any> {
    return this.http.post(rotas.reservas.criar, reserva, this.httpOptions);
  }

  criarEvento(evento: any): Observable<any> {
    return this.http.post(rotas.eventos.criar, evento, this.httpOptions);
  }

  listarEventos(): Observable<any> {
    return this.http.get(rotas.eventos.listar, this.httpOptions);
  }

  cancelarReserva(id: number): Observable<any> {
    return this.http.patch(rotas.reservas.cancelar(id), {}, this.httpOptions);
  }

  aprovarReserva(id: number): Observable<any> {
    return this.http.patch(rotas.reservas.aprovar(id), {}, this.httpOptions);
  }

  rejeitarReserva(id: number, motivo?: string): Observable<any> {
    const body = motivo
      ? { motivo, motivoRejeicao: motivo, justificativa: motivo }
      : {};

    return this.http.patch(rotas.reservas.rejeitar(id), body, this.httpOptions);
  }

  substituirReservaEvento(id: number, reserva: any): Observable<any> {
    return this.http.patch(rotas.reservas.substituir(id), reserva, this.httpOptions);
  }

  gerarRelatorio(filtros: any): Observable<any> {
    return this.listarReservas();
  }
}
