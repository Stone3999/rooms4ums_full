import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const POST_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'RESUELTO'] as const;
export const POST_PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  @MaxLength(5000)
  content: string;

  @IsString()
  @IsNotEmpty({ message: 'La sala es obligatoria' })
  @MaxLength(64)
  roomId: string;

  @IsOptional()
  tags?: string[] | string;

  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(POST_PRIORITIES)
  priority?: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(POST_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedAgentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @MaxLength(2000)
  content: string;
}
