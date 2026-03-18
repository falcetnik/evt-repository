import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export const EVENT_LIST_SCOPES = ['upcoming', 'past', 'all'] as const;

export type EventListScope = (typeof EVENT_LIST_SCOPES)[number];

export class ListEventsQueryDto {
  @Transform(({ value }) => value ?? 'upcoming')
  @IsIn(EVENT_LIST_SCOPES)
  scope: EventListScope = 'upcoming';
}
