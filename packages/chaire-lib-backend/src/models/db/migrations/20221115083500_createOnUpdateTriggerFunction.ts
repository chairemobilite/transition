import { Knex } from 'knex';

const onUpdateTimestampFunction = `
  CREATE OR REPLACE FUNCTION on_update_timestamp()
  RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
$$ language 'plpgsql';
`;

const dropOnUpdateTimestampFunction = 'DROP FUNCTION on_update_timestamp()';

export const up = async (knex: Knex) => knex.schema.raw(onUpdateTimestampFunction);
export const down = async (knex: Knex) => knex.schema.raw(dropOnUpdateTimestampFunction);
