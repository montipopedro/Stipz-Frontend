import { Routes } from '@angular/router';
import { CadastrarUsuario } from './cadastrar-usuario/cadastrar-usuario';
import { CadastrarSala } from './cadastrar-sala/cadastrar-sala';
import { CadastrarRecurso } from './cadastrar-recurso/cadastrar-recurso';
import { LoginComponent } from './login/login';
import { MeusAgendamentosComponent } from './meus-agendamentos/meus-agendamentos';
import { ReservarSalaComponent } from './reservar-sala/reservar-sala';
import { CancelarReservaComponent } from './cancelar-reserva/cancelar-reserva';
import { ReservasPendentesComponent } from './reservas-pendentes/reservas-pendentes';
import { ReservarEventoComponent } from './reservar-evento/reservar-evento';
import { GerarRelatorioComponent } from './gerar-relatorio/gerar-relatorio';
import { authGuard } from './guards/auth.guard';
import { LayoutComponent } from './layout/layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'agendamentos', component: MeusAgendamentosComponent, canActivate: [authGuard], data: { perfis: ['ADMIN', 'COMUM'] } },
      { path: 'reservar', component: ReservarSalaComponent, canActivate: [authGuard] },
      { path: 'cancelar', component: CancelarReservaComponent, canActivate: [authGuard] },
      { path: 'pendentes', component: ReservasPendentesComponent, canActivate: [authGuard], data: { perfis: ['ADMIN'] } },
      { path: 'evento', component: ReservarEventoComponent, canActivate: [authGuard] },
      { path: 'usuario', component: CadastrarUsuario, canActivate: [authGuard], data: { perfis: ['ADMIN'] } },
      { path: 'sala', component: CadastrarSala, canActivate: [authGuard], data: { perfis: ['ADMIN'] } },
      { path: 'recurso', component: CadastrarRecurso, canActivate: [authGuard], data: { perfis: ['ADMIN'] } },
      { path: 'relatorio', component: GerarRelatorioComponent, canActivate: [authGuard], data: { perfis: ['ADMIN'] } },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
