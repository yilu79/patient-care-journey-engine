import { evaluateCondition } from '../../src/services/executor';
import { PatientContext } from '../../src/types/journey';

describe('Conditional Expression Evaluator', () => {
  const patientContext: PatientContext = {
    patient_id: 'test-patient-001',
    age: 45,
    condition: 'diabetes',
    score: 85,
    name: 'John Doe',
  };

  describe('Greater Than (>) operator', () => {
    it('should return true when field value is greater than comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '>', 40)).toBe(true);
      expect(evaluateCondition(patientContext, 'score', '>', 80)).toBe(true);
    });

    it('should return false when field value is less than or equal to comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '>', 45)).toBe(false);
      expect(evaluateCondition(patientContext, 'age', '>', 50)).toBe(false);
    });
  });

  describe('Less Than (<) operator', () => {
    it('should return true when field value is less than comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '<', 50)).toBe(true);
      expect(evaluateCondition(patientContext, 'score', '<', 90)).toBe(true);
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
      expect(evaluateCondition(patientContext, 'score', '=', 85)).toBe(true);
    });

    it('should return true when field value equals comparison value (strings)', () => {
      expect(evaluateCondition(patientContext, 'condition', '=', 'diabetes')).toBe(true);
      expect(evaluateCondition(patientContext, 'name', '=', 'John Doe')).toBe(true);
    });

    it('should return false when field value does not equal comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '=', 50)).toBe(false);
      expect(evaluateCondition(patientContext, 'condition', '=', 'asthma')).toBe(false);
    });

    it('should handle == operator as alias for =', () => {
      expect(evaluateCondition(patientContext, 'age', '==', 45)).toBe(true);
      expect(evaluateCondition(patientContext, 'age', '==', 50)).toBe(false);
    });
  });

  describe('Inequality (!=) operator', () => {
    it('should return true when field value does not equal comparison value (numbers)', () => {
      expect(evaluateCondition(patientContext, 'age', '!=', 50)).toBe(true);
      expect(evaluateCondition(patientContext, 'score', '!=', 90)).toBe(true);
    });

    it('should return true when field value does not equal comparison value (strings)', () => {
      expect(evaluateCondition(patientContext, 'condition', '!=', 'asthma')).toBe(true);
      expect(evaluateCondition(patientContext, 'name', '!=', 'Jane Doe')).toBe(true);
    });

    it('should return false when field value equals comparison value', () => {
      expect(evaluateCondition(patientContext, 'age', '!=', 45)).toBe(false);
      expect(evaluateCondition(patientContext, 'condition', '!=', 'diabetes')).toBe(false);
    });
  });

  describe('Nested field paths', () => {
    const nestedContext: PatientContext = {
      patient_id: 'test-patient-002',
      age: 30,
      patient: {
        age: 35,
        name: 'Alice',
      },
    };

    it('should evaluate simple field paths', () => {
      expect(evaluateCondition(nestedContext, 'age', '=', 30)).toBe(true);
    });

    it('should evaluate nested field paths with dot notation', () => {
      expect(evaluateCondition(nestedContext, 'patient.age', '=', 35)).toBe(true);
      expect(evaluateCondition(nestedContext, 'patient.name', '=', 'Alice')).toBe(true);
    });

    it('should handle missing nested fields gracefully', () => {
      expect(evaluateCondition(nestedContext, 'patient.missing', '=', null)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle comparison with zero', () => {
      const zeroContext: PatientContext = {
        patient_id: 'test',
        age: 0,
      };
      expect(evaluateCondition(zeroContext, 'age', '=', 0)).toBe(true);
      expect(evaluateCondition(zeroContext, 'age', '>', 0)).toBe(false);
      expect(evaluateCondition(zeroContext, 'age', '<', 1)).toBe(true);
    });

    it('should handle negative numbers', () => {
      const negContext: PatientContext = {
        patient_id: 'test',
        age: -5,
        balance: -100,
      };
      expect(evaluateCondition(negContext, 'age', '<', 0)).toBe(true);
      expect(evaluateCondition(negContext, 'balance', '=', -100)).toBe(true);
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
        patient_id: 'test',
        age: 45 as any,
      };
      // JavaScript's == does type coercion
      expect(evaluateCondition(stringContext, 'age', '=', '45')).toBe(true);
    });
  });
});
