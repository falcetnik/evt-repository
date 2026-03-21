import type { EventCurrentInviteLinkResponse } from '../../api/event-current-invite-link';
import type { OrganizerInviteLink } from '../../api/invite-link';

export type CurrentInviteLinkSectionState = {
  status: 'loading' | 'empty' | 'success' | 'error';
  message: string | null;
  inviteLink: OrganizerInviteLink | null;
};

export type BuildCurrentInviteLinkSectionStateInput = {
  isLoading: boolean;
  response?: EventCurrentInviteLinkResponse | null;
  errorMessage?: string | null;
};

export const buildCurrentInviteLinkSectionState = ({
  isLoading,
  response,
  errorMessage,
}: BuildCurrentInviteLinkSectionStateInput): CurrentInviteLinkSectionState => {
  if (isLoading) {
    return {
      status: 'loading',
      message: 'Loading invite link...',
      inviteLink: null,
    };
  }

  if (response?.inviteLink) {
    return {
      status: 'success',
      message: null,
      inviteLink: response.inviteLink,
    };
  }

  if (response?.inviteLink === null) {
    return {
      status: 'empty',
      message: 'No active invite link yet.',
      inviteLink: null,
    };
  }

  return {
    status: 'error',
    message: errorMessage ?? 'Could not load invite link.',
    inviteLink: null,
  };
};
