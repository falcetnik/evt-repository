import type { PublicRsvpStatus, SubmitPublicRsvpPayload } from '../../api/public-invite';

export type PublicRsvpFormInput = {
  guestName: string;
  guestEmail: string;
  status: string;
};

type PublicRsvpFormFieldErrors = {
  guestName?: string;
  guestEmail?: string;
  status?: string;
};

export type BuildPublicRsvpPayloadResult =
  | { ok: true; payload: SubmitPublicRsvpPayload }
  | {
      ok: false;
      message: string;
      fieldErrors: PublicRsvpFormFieldErrors;
    };

const isValidStatus = (status: string): status is PublicRsvpStatus =>
  status === 'going' || status === 'maybe' || status === 'not_going';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const buildPublicRsvpPayloadFromForm = (form: PublicRsvpFormInput): BuildPublicRsvpPayloadResult => {
  const guestName = form.guestName.trim();
  const guestEmail = form.guestEmail.trim().toLowerCase();
  const status = form.status;

  const fieldErrors: PublicRsvpFormFieldErrors = {};

  if (!guestName) {
    fieldErrors.guestName = 'Guest name is required.';
  } else if (guestName.length > 80) {
    fieldErrors.guestName = 'Guest name must be 80 characters or fewer.';
  }

  if (!guestEmail) {
    fieldErrors.guestEmail = 'Guest email is required.';
  } else if (guestEmail.length > 320) {
    fieldErrors.guestEmail = 'Guest email must be 320 characters or fewer.';
  } else if (!emailPattern.test(guestEmail)) {
    fieldErrors.guestEmail = 'Enter a valid email address.';
  }

  if (!isValidStatus(status)) {
    fieldErrors.status = 'Select an RSVP status.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: 'Please fix the highlighted fields',
      fieldErrors,
    };
  }

  const normalizedStatus = status as PublicRsvpStatus;

  return {
    ok: true,
    payload: {
      guestName,
      guestEmail,
      status: normalizedStatus,
    },
  };
};
