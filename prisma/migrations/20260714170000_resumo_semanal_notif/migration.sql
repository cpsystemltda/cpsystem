-- Regina 14/07: resumos semanais consolidados. Chave (usuarioId, tipo,
-- referenciaId=YYYY-Wxx) garante 1 msg/semana por destinatario.
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE 'RESUMO_SEMANAL_EMPRESA';
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE 'RESUMO_SEMANAL_ANALISTA';
