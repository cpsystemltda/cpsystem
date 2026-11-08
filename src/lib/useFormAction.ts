"use client";

import { useCallback, useState, useTransition, type FormEvent } from "react";

/**
 * Submete um formulário a uma server action SEM o reset automático que o
 * React 19 aplica a `<form action={…}>`: quando a action devolve erro
 * (CPF duplicado, titular em dois postos…), a pessoa corrige um campo e
 * reenvia, em vez de preencher tudo de novo.
 *
 * Uso: `const { state, onSubmit, pending } = useFormAction(minhaAction, (r) => …)`
 * e `<form onSubmit={onSubmit}>`.
 */
export function useFormAction<R extends { ok?: boolean } | null>(
  action: (prev: R | null, fd: FormData) => Promise<R>,
  onOk?: (r: NonNullable<R>) => void,
) {
  const [state, setState] = useState<R | null>(null);
  const [pending, startTransition] = useTransition();
  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      // Botão que disparou o envio (name/value), como no submit nativo.
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.name) fd.append(submitter.name, submitter.value);
      startTransition(async () => {
        const r = await action(state, fd);
        setState(r);
        if (r && r.ok && onOk) onOk(r as NonNullable<R>);
      });
    },
    [action, onOk, state],
  );
  return { state, onSubmit, pending, reset: () => setState(null) };
}
