// The words of identity's emails, in EN and UK (voice and tone doc: login is "serious and careful").
// They live here, not in the web app's next-intl catalogs, because the worker sends emails too.
// Ukrainian copy avoids gendered past-tense verbs about the reader.

export const emailLocales = ['en', 'uk'] as const;
export type EmailLocale = (typeof emailLocales)[number];

export function isEmailLocale(value: unknown): value is EmailLocale {
  return (emailLocales as readonly unknown[]).includes(value);
}

interface Messages {
  loginCode: {
    subject: string;
    preview: string;
    intro: string;
    validFor: (minutes: number) => string;
    button: string;
    ignore: string;
  };
  emailChangeCode: {
    subject: string;
    intro: string;
    validFor: (minutes: number) => string;
    ignore: string;
  };
  newDevice: {
    subject: string;
    preview: string;
    intro: (device: string, time: string) => string;
    ifYou: string;
    ifNot: string;
  };
  emailChanged: {
    subject: string;
    intro: (time: string) => string;
    ifYou: string;
    ifNot: string;
  };
  unknownDevice: string;
  footer: string;
}

const minutesUk = (n: number) => {
  const plural = new Intl.PluralRules('uk').select(n);
  return `${String(n)} ${plural === 'one' ? 'хвилину' : plural === 'few' ? 'хвилини' : 'хвилин'}`;
};

export const emailMessages: Record<EmailLocale, Messages> = {
  en: {
    loginCode: {
      subject: 'Your Chaku login code',
      preview: 'Your login code is inside.',
      intro: 'Your login code:',
      validFor: (minutes) =>
        `It works for ${String(minutes)} minutes. Or log in on this device with the button:`,
      button: 'Log in to Chaku',
      ignore: "Didn't ask for a code? Ignore this email. Nobody can log in without it.",
    },
    emailChangeCode: {
      subject: 'Confirm your new Chaku email address',
      intro: 'Your code to confirm this address:',
      validFor: (minutes) => `It works for ${String(minutes)} minutes.`,
      ignore: "Didn't ask for this? Ignore this email. Nothing changes without the code.",
    },
    newDevice: {
      subject: 'New login to your Chaku account',
      preview: 'Your account was used on a new device.',
      intro: (device, time) => `Your account was used to log in on ${device}, ${time}.`,
      ifYou: 'If this was you, there is nothing to do.',
      ifNot:
        "If it wasn't you, open Settings → Sessions, log that device out, and tell Chaku's admins.",
    },
    emailChanged: {
      subject: 'The email address of your Chaku account was changed',
      intro: (time) =>
        `The email address of your Chaku account was changed to another address, ${time}. This address no longer logs in.`,
      ifYou: 'If this was you, there is nothing to do.',
      ifNot: "If it wasn't you, tell Chaku's admins right away so they can help you get it back.",
    },
    unknownDevice: 'an unknown device',
    footer: 'Chaku sends this email to keep your account safe.',
  },
  uk: {
    loginCode: {
      subject: 'Твій код для входу в Chaku',
      preview: 'Код для входу всередині.',
      intro: 'Твій код для входу:',
      validFor: (minutes) => `Він діє ${minutesUk(minutes)}. Або увійди на цьому пристрої кнопкою:`,
      button: 'Увійти в Chaku',
      ignore: 'Не чекаєш на цей лист? Просто проігноруй його: без коду ніхто не увійде.',
    },
    emailChangeCode: {
      subject: 'Підтвердь нову адресу пошти для Chaku',
      intro: 'Твій код, щоб підтвердити цю адресу:',
      validFor: (minutes) => `Він діє ${minutesUk(minutes)}.`,
      ignore: 'Не чекаєш на цей лист? Просто проігноруй його: без коду нічого не зміниться.',
    },
    newDevice: {
      subject: 'Новий вхід у твій акаунт Chaku',
      preview: 'У твій акаунт увійшли з нового пристрою.',
      intro: (device, time) => `Новий вхід у твій акаунт: ${device}, ${time}.`,
      ifYou: 'Якщо це ти, нічого робити не треба.',
      ifNot:
        'Якщо ні, відкрий Налаштування → Сеанси, вийди з цього пристрою й напиши адміністраторам Chaku.',
    },
    emailChanged: {
      subject: 'Адресу пошти твого акаунта Chaku змінено',
      intro: (time) =>
        `Адресу пошти твого акаунта Chaku змінено на іншу, ${time}. Через цю адресу більше не можна увійти.`,
      ifYou: 'Якщо зміна твоя, нічого робити не треба.',
      ifNot: 'Якщо ні, одразу напиши адміністраторам Chaku, щоб вони допомогли повернути акаунт.',
    },
    unknownDevice: 'невідомий пристрій',
    footer: 'Chaku надсилає цей лист, щоб захистити твій акаунт.',
  },
};

/** A point in time for an email: the reader's time zone is unknown, so it says UTC. */
export function formatEmailTime(date: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
    .format(date)
    .concat(' UTC');
}
