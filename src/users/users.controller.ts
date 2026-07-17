import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';
import { UpdateProfileSchema, type UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileEntity } from './entities/user-profile.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('User Profile')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's profile" })
  @ApiResponse({ status: HttpStatus.OK, type: UserProfileEntity })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  async getProfile(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: UserProfileEntity }> {
    const profile = await this.usersService.getProfile(user.id);
    return { message: 'Profile retrieved successfully', data: profile };
  }

  @Patch()
  @ApiOperation({ summary: "Update the current user's name, phone, or avatarUrl" })
  @ApiBody({ schema: z.toJSONSchema(UpdateProfileSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: UserProfileEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<{ message: string; data: UserProfileEntity }> {
    const profile = await this.usersService.updateProfile(user.id, dto);
    return { message: 'Profile updated successfully', data: profile };
  }
}
