import "server-only"

const dictionaries: { [key: string]: () => Promise<any> } = {
  en: () => import("@/locales/en.json").then((module) => module.default),
  hu: () => import("@/locales/hu.json").then((module) => module.default),
  ro: () => import("@/locales/ro.json").then((module) => module.default),
}

export const getDictionary = async (locale: string) => {
  const loader = dictionaries[locale] || dictionaries.en
  return loader()
}
