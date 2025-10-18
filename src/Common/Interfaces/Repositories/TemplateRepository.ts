export interface TemplateRepository {
  findActive(type: string, channel: string): Promise<any | null>;
}

export const TEMPLATE_REPOSITORY = Symbol('TEMPLATE_REPOSITORY');
