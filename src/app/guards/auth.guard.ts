import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, PerfilUsuario } from '../services/auth';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const perfisPermitidos = route.data?.['perfis'] as PerfilUsuario[] | undefined;

  if (!auth.temSessao()) {
    return router.createUrlTree(['/login']);
  }

  if (auth.usuarioAtual) {
    return auth.podeAcessar(perfisPermitidos) ? true : rotaInicialPorPerfil(auth, router);
  }

  return auth.carregarUsuario().pipe(
    map(() => auth.podeAcessar(perfisPermitidos) ? true : rotaInicialPorPerfil(auth, router))
  );
};

function rotaInicialPorPerfil(auth: AuthService, router: Router) {
  return router.createUrlTree([auth.isAdmin() ? '/pendentes' : '/agendamentos']);
}
