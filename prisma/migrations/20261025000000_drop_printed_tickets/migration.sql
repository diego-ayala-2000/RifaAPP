-- Se elimina la funcionalidad de tickets presenciales. Las ventas que se registraron
-- con esos tickets se mantienen en "transactions" y "raffle_numbers".
DROP TABLE IF EXISTS "printed_tickets";
