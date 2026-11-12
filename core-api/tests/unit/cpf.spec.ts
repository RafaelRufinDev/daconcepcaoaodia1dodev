import { isValidCpf, normalizeCpf } from '../../src/domain/value-objects/cpf';

describe('CPF', () => {
  it('normaliza máscara para apenas dígitos', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });

  it('valida CPFs com dígitos verificadores corretos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('rejeita CPFs inválidos', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});
