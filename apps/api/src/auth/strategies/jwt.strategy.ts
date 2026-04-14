// ═══════════════════════════════════════════════════════════
// JWT STRATEGY + AUTH GUARDS + ROLES GUARD
// ═══════════════════════════════════════════════════════════
import {
  Injectable, ExecutionContext, CanActivate,
  UnauthorizedException, SetMetadata, createParamDecorator,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Rol } from '@prisma/client';

// ─── JWT Payload ──────────────────────────────────────────
export interface JwtPayload {
  sub: string;         // userId
  email: string;
  roles: Rol[];
  sedeId: string;
  medicoId: string | null;
  iat: number;
  mfa_pending?: boolean;
}

// ─── JWT Strategy ─────────────────────────────────────────
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: 'sgci',
      audience: 'sgci-staff',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.mfa_pending) {
      throw new UnauthorizedException('MFA verification required');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sedeId: payload.sedeId,
      medicoId: payload.medicoId,
    };
  }
}

// ─── Local Strategy (email + password) ───────────────────
import { PassportStrategy as PS2 } from '@nestjs/passport';
import { Strategy as LS } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PS2(LS) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(req: any, email: string, password: string) {
    return this.authService.validateUser(email, password);
  }
}

// ─── JWT Auth Guard ───────────────────────────────────────
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException(info?.message ?? 'Token inválido o expirado');
    }
    return user;
  }
}

// ─── Roles Guard ─────────────────────────────────────────
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const tieneRol = required.some((r) => user?.roles?.includes(r));
    if (!tieneRol) throw new UnauthorizedException('No tiene los permisos necesarios');
    return true;
  }
}

// ─── Sede Guard — valida que el usuario tenga acceso a la sede del request ──
@Injectable()
export class SedeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const sedeId = req.headers['x-sede-id'] ?? req.params.sedeId ?? req.body?.sedeId;

    if (!sedeId) return true; // Sin sede en el request, no validar
    if (user?.roles?.includes(Rol.SUPERADMIN)) return true; // Superadmin accede a todas

    if (user?.sedeId !== sedeId) {
      throw new UnauthorizedException('No tiene acceso a esa sede');
    }
    return true;
  }
}

// ─── Decoradores personalizados ───────────────────────────
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});

export const ClientIp = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? '0.0.0.0';
});

export const SedeId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.headers['x-sede-id'] ?? req.user?.sedeId;
});
