-- Papel moderador (parte 1): adicionar valor ao enum em transação separada

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';