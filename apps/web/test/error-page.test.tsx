// @vitest-environment happy-dom
// CHK-19: the error page speaks the viewer's language and reports through the errors adapter.
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ErrorPage from '../app/error.tsx';
import en from '../messages/en.json';
import uk from '../messages/uk.json';

const capture = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/errors.ts', () => ({ browserErrors: { capture } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;

async function render(locale: 'en' | 'uk', error: Error & { digest?: string }, reset = vi.fn()) {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : uk}>
        <ErrorPage error={error} reset={reset} />
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });
  return { root, reset };
}

afterEach(() => {
  container.remove();
  capture.mockReset();
});

describe('error page', () => {
  it('is in Ukrainian for a Ukrainian viewer', async () => {
    await render('uk', new Error('boom'));
    expect(container.querySelector('h1')?.textContent).toBe('Щось пішло не так');
    expect(container.querySelector('button')?.textContent).toBe('Спробувати ще раз');
  });

  it('is in English for an English viewer', async () => {
    await render('en', new Error('boom'));
    expect(container.querySelector('h1')?.textContent).toBe('Something went wrong');
  });

  it('reports the error with its digest, which matches the server log', async () => {
    const error = Object.assign(new Error('boom'), { digest: '1234567' });
    await render('en', error);
    expect(capture).toHaveBeenCalledWith(error, { tags: { digest: '1234567' } });
  });

  it('tries again with the button', async () => {
    const { reset } = await render('en', new Error('boom'));
    await act(async () => {
      container.querySelector('button')?.click();
      await Promise.resolve();
    });
    expect(reset).toHaveBeenCalled();
  });
});
