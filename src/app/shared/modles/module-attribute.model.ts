// src/app/shared/modles/module-attribute.model.ts
export interface ModuleAttribute {
    id: string;
    moduleId: string;
    name: string;
    key: string;
    type: 'text' | 'number' | 'boolean' | 'select';
    isRequired: boolean;
    options?: string[]; // For select type
}