-- Allow registration decision + substitution opponent notification types

ALTER TABLE player_notifications
  DROP CONSTRAINT IF EXISTS player_notifications_type_check;

ALTER TABLE player_notifications
  ADD CONSTRAINT player_notifications_type_check CHECK (
    type IN (
      'substitution_filed',
      'substitution_assigned',
      'substitution_opponent_update',
      'substitution_cancelled',
      'registration_approved',
      'registration_rejected',
      'registration_waitlisted',
      'broadcast'
    )
  );
