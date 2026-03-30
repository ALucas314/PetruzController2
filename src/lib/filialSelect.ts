/** Valor interno do Select quando nenhuma filial foi escolhida (padrão do campo Filial em Movimentação de túneis). */
export const FILIAL_PLACEHOLDER_VALUE = "__placeholder_filial__";

/** Primeira linha do Select, desabilitada — igual Movimentação de túneis. */
export const FILIAL_PLACEHOLDER_LABEL = "Selecione a filial";

/** Ordena filiais pelo nome completo (cadastro OCTF), pt-BR. */
export function sortFiliaisByNome<T extends { nome: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }),
  );
}
