import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/auditService';

const prisma = new PrismaClient();
let mathJsPromise: Promise<any> | null = null;

const getMathJs = () => {
  if (!mathJsPromise) {
    mathJsPromise = import('mathjs');
  }
  return mathJsPromise;
};

// Whitelist of allowed mathjs function names to prevent abuse
const SAFE_FUNCTIONS = new Set([
  'abs', 'ceil', 'floor', 'round', 'sqrt', 'pow', 'log', 'log10', 'log2',
  'max', 'min', 'mod', 'sign', 'exp', 'sin', 'cos', 'tan',
]);

/**
 * Validates that a formula expression only uses safe math operations.
 * Throws if any unsafe node (assignment, function calls not in whitelist, etc.) is found.
 */
async function validateExpression(expression: string): Promise<void> {
  const { parse } = await getMathJs();
  const tree = parse(expression);
  tree.traverse((node: any) => {
    if (node.type === 'AssignmentNode') {
      throw new Error('Assignments are not allowed in formula expressions.');
    }
    if (node.type === 'FunctionNode') {
      if (!SAFE_FUNCTIONS.has(node.name)) {
        throw new Error(`Function "${node.name}" is not allowed. Use only: ${[...SAFE_FUNCTIONS].join(', ')}.`);
      }
    }
    if (node.type === 'SymbolNode' && node.name === 'import') {
      throw new Error('Import is not allowed in formula expressions.');
    }
  });
}

export class FormulaController {
  /**
   * List all formula master records.
   */
  public static async list(req: Request, res: Response) {
    try {
      const formulas = await prisma.formulaMaster.findMany({
        where: { is_deleted: false },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });

      return res.json(formulas.map(f => ({
        ...f,
        variables: f.variables ? JSON.parse(f.variables) : [],
      })));
    } catch (error) {
      console.error('List Formulas Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Create a new formula master record.
   */
  public static async create(req: Request, res: Response) {
    try {
      const { name, description, expression, category, variables } = req.body;

      if (!name || !expression) {
        return res.status(400).json({ message: 'Formula name and expression are required.' });
      }

      // Validate expression safety
      try {
        await validateExpression(expression);
      } catch (validationErr: any) {
        return res.status(400).json({ message: `Invalid formula expression: ${validationErr.message}` });
      }

      const existing = await prisma.formulaMaster.findFirst({
        where: { name, is_deleted: false },
      });

      if (existing) {
        return res.status(400).json({ message: 'A formula with this name already exists.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      const formula = await prisma.formulaMaster.create({
        data: {
          name,
          description,
          expression,
          category: category || 'GENERAL',
          variables: variables ? JSON.stringify(variables) : null,
          isActive: false, // New formulas start inactive until tested and activated
          created_by: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'FORMULA',
        newValue: { formulaId: formula.id, name, expression },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(201).json({ ...formula, variables: formula.variables ? JSON.parse(formula.variables) : [] });
    } catch (error) {
      console.error('Create Formula Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Update an existing formula. Auto-increments the version number.
   */
  public static async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid formula ID.' });

      const formula = await prisma.formulaMaster.findFirst({
        where: { id, is_deleted: false },
      });

      if (!formula) return res.status(404).json({ message: 'Formula not found.' });

      const { name, description, expression, category, variables } = req.body;

      // Validate new expression if provided
      const newExpression = expression || formula.expression;
      try {
        await validateExpression(newExpression);
      } catch (validationErr: any) {
        return res.status(400).json({ message: `Invalid formula expression: ${validationErr.message}` });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      // If expression changed, bump version and deactivate (requires re-testing)
      const expressionChanged = expression && expression !== formula.expression;
      const newVersion = expressionChanged ? formula.version + 1 : formula.version;
      const newIsActive = expressionChanged ? false : formula.isActive; // deactivate on expression change

      const updated = await prisma.formulaMaster.update({
        where: { id },
        data: {
          name: name || formula.name,
          description: description !== undefined ? description : formula.description,
          expression: newExpression,
          category: category || formula.category,
          variables: variables !== undefined ? JSON.stringify(variables) : formula.variables,
          version: newVersion,
          isActive: newIsActive,
          updated_by: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'FORMULA',
        oldValue: { id, expression: formula.expression, version: formula.version },
        newValue: { id, expression: newExpression, version: newVersion },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ ...updated, variables: updated.variables ? JSON.parse(updated.variables) : [] });
    } catch (error) {
      console.error('Update Formula Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Test a formula expression in a safe sandbox using mathjs.
   * NO eval() — uses mathjs.evaluate() which is sandboxed.
   */
  public static async testFormula(req: Request, res: Response) {
    try {
      const { expression, variables } = req.body;

      if (!expression) {
        return res.status(400).json({ message: 'Expression is required for testing.' });
      }

      // Validate safety first
      try {
        await validateExpression(expression);
      } catch (validationErr: any) {
        return res.status(400).json({ message: `Invalid expression: ${validationErr.message}` });
      }

      // variables should be an object like { principal: 100000, rate: 2, tenure: 12 }
      const scope = variables && typeof variables === 'object' ? variables : {};

      // Ensure all scope values are numbers
      for (const [key, val] of Object.entries(scope)) {
        if (typeof val !== 'number') {
          return res.status(400).json({ message: `Variable "${key}" must be a number.` });
        }
      }

      let result: any;
      try {
        const { evaluate } = await getMathJs();
        result = evaluate(expression, scope);
      } catch (evalErr: any) {
        return res.status(400).json({
          message: `Formula evaluation error: ${evalErr.message}`,
          expression,
          variables: scope,
        });
      }

      return res.json({
        expression,
        variables: scope,
        result: typeof result === 'number' ? Math.round(result * 10000) / 10000 : result,
        resultType: typeof result,
      });
    } catch (error) {
      console.error('Test Formula Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Activate a formula (makes it the "live" version).
   * Automatically deactivates all other active formulas of the same category.
   */
  public static async activate(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid formula ID.' });

      const formula = await prisma.formulaMaster.findFirst({
        where: { id, is_deleted: false },
      });

      if (!formula) return res.status(404).json({ message: 'Formula not found.' });

      const userEmail = req.user?.email || 'SYSTEM';

      // Perform activation and deactivation of others in a Prisma transaction
      const [updated] = await prisma.$transaction([
        prisma.formulaMaster.update({
          where: { id },
          data: { isActive: true, updated_by: userEmail },
        }),
        prisma.formulaMaster.updateMany({
          where: {
            category: formula.category,
            id: { not: id },
            isActive: true,
            is_deleted: false,
          },
          data: { isActive: false, updated_by: userEmail },
        }),
      ]);

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'FORMULA',
        oldValue: { id, isActive: false },
        newValue: { id, isActive: true, deactivatedOthersInCategory: formula.category },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: `Formula "${formula.name}" activated. Other formulas in "${formula.category}" deactivated.`, formula: updated });
    } catch (error) {
      console.error('Activate Formula Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Deactivate a formula.
   */
  public static async deactivate(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid formula ID.' });

      const formula = await prisma.formulaMaster.findFirst({
        where: { id, is_deleted: false },
      });

      if (!formula) return res.status(404).json({ message: 'Formula not found.' });

      const userEmail = req.user?.email || 'SYSTEM';

      const updated = await prisma.formulaMaster.update({
        where: { id },
        data: { isActive: false, updated_by: userEmail },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'FORMULA',
        oldValue: { id, isActive: true },
        newValue: { id, isActive: false },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: `Formula "${formula.name}" deactivated.`, formula: updated });
    } catch (error) {
      console.error('Deactivate Formula Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Soft-delete a formula.
   */
  public static async softDelete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid formula ID.' });

      const formula = await prisma.formulaMaster.findFirst({
        where: { id, is_deleted: false },
      });

      if (!formula) return res.status(404).json({ message: 'Formula not found.' });

      const userEmail = req.user?.email || 'SYSTEM';

      await prisma.formulaMaster.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: userEmail,
          isActive: false,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'DELETE',
        module: 'FORMULA',
        oldValue: { id, name: formula.name },
        newValue: { id, is_deleted: true, deleted_by: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: `Formula "${formula.name}" soft-deleted.` });
    } catch (error) {
      console.error('Delete Formula Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
}
