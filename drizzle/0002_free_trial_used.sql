-- Free-trial usage is tracked permanently on the user row, so one lifetime
-- free trial per registered user (deleting a website can never reset it).
ALTER TABLE "users" ADD COLUMN "free_trial_used" boolean DEFAULT false NOT NULL;
