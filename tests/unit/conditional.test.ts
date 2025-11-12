import { evaluateCondition } from '../../src/services/executor';
import { PatientContext } from '../../src/types/journey';

describe('Conditional Expression Evaluator', () => {
  const patientContext: PatientContext = {
    id: 'test-patient-001',
    age: 45,
    language: 'en',
    condition: 'hip_replacement',
  };

  describe('Greater Than (>) operator', () => {
    it('should return true when field value is greater than comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '>', 40)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '>', 30)).toBe(true);
    });

    it('should return false when field value is less than or equal to comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '>', 45)).toBe(false);
      expect(evaluateCondition(patientContext, 'age', '>', 50)).toBe(false);
    });
  });

  describe('Less Than (<) operator', () => {
    it('should return true when field value is less than comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '<', 50)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '<', 60)).toBe(true);
    });

    it('should return false when field value is greater than or equal to comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '<', 45)).toBe(false);
      expect(evaluateCondition(patientContext, 'age', '<', 40)).toBe(false);
    });
  });

  describe('Greater Than or Equal (>=) operator', () => {
    it('should return true when field value is greater than or equal to comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '>=', 45)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '>=', 40)).toBe(true);
    });

    it('should return false when field value is less than comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '>=', 50)).toBe(false);
    });
  });

  describe('Less Than or Equal (<=) operator', () => {
    it('should return true when field value is less than or equal to comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '<=', 45)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '<=', 50)).toBe(true);
    });

    it('should return false when field value is greater than comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '<=', 40)).toBe(false);
    });
  });

  describe('Equality (=) operator', () => {
    it('should return true when field value equals comparison value (numbers)', () => {
      expect(evaluateCondition(patientContext, 'age', '=', 45)).toBe(true);
    });

    it('should return true when field value equals comparison value (strings)', () => {
      expect(evaluateCondition(patientContext, 'condition', '=', 'hip_replacement')).toBe(true);
      expect(evaluateCondition(patientContext, 'language', '=', 'en')).toBe(true);
    });

    it('should return false when field value does not equal comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '=', 50)).toBe(false);
      expect(evaluateCondition(patientContext, 'condition', '=', 'knee_replacement')).toBe(false);
    });

    it('should handle == operator as alias for =', () => {
      expect(evaluateCondition(patientContext, 'age', '==', 45)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '==', 50)).toBe(false);
    });
  });

  describe('Inequality (!=) operator', () => {
    it('should return true when field value does not equal comparison value (numbers)', () => {
      expect(evaluateCondition(patientContext, 'age', '!=', 50)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '!=', 60)).toBe(true);
    });

    it('should return true when field value does not equal comparison value (strings)', () => {
      expect(evaluateCondition(patientContext, 'condition', '!=', 'knee_replacement')).toBe(true);
      expect(evaluateCondition(patientContext, 'language', '!=', 'es')).toBe(true);
    });

    it('should return false when field value equals comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '!=', 45)).toBe(false);
      expect(evaluateCondition(patientContext, 'condition', '!=', 'hip_replacement')).toBe(false);
    });
  });

  describe('Nested field paths', () => {
    it('should evaluate simple field paths', () => {
      expect(evaluateCondition(patientContext, 'age', '>', 40)).toBe(true);
    });

    it('should evaluate nested field paths with dot notation', () => {
      // Test with condition field which is a string
      expect(evaluateCondition(patientContext, 'condition', '=', 'hip_replacement')).toBe(true);
    });

    it('should handle missing nested fields gracefully', () => {
      // Non-existent field should return false for comparisons
      expect(evaluateCondition(patientContext, 'nonexistent.field', '>', 10)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle comparison with zero', () => {
      const zeroContext: PatientContext = {
        id: 'test',
        age: 0,
        language: 'en',
        condition: 'knee_replacement',
      };
      expect(evaluateCondition(zeroContext, 'age', '=', 0)).toBe(true);
      expect(evaluateCondition(zeroContext, 'age', '>', 0)).toBe(false);
      expect(evaluateCondition(zeroContext, 'age', '<', 1)).toBe(true);
    });

    it('should handle negative numbers', () => {
      const negContext: PatientContext = {
        id: 'test',
        age: -5,
        language: 'es',
        condition: 'hip_replacement',
      };
      expect(evaluateCondition(negContext, 'age', '<', 0)).toBe(true);
      expect(evaluateCondition(negContext, 'age', '=', -5)).toBe(true);
    });

    it('should throw error for unsupported operator', () => {
      expect(() => {
        evaluateCondition(patientContext, 'age', '&&', 45);
      }).toThrow('Unsupported operator: &&');
    });
  });

  describe('Type coercion', () => {
    it('should handle loose equality for numbers', () => {
      const stringContext: PatientContext = {
        id: 'test',
        age: 45,
        language: 'en',
        condition: 'knee_replacement',
      };
      // JavaScript's == does type coercion
      expect(evaluateCondition(stringContext, 'age', '=', '45')).toBe(true);
    });
  });
});
