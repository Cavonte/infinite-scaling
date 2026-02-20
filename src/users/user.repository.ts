import { db } from "../db/db_router.js";

export type User = { id: number; name: string; location: string | null };
export type CreateUserInput = { name: string; location?: string };
export type UpdateUserInput = { name?: string; location?: string };

export const userRepository = {
	async findAll(): Promise<User[]> {
		return db.read<User[]>`SELECT id, name, location FROM users ORDER BY id`;
	},

	async findById(id: number): Promise<User | null> {
		const rows = await db.read<
			User[]
		>`SELECT id, name, location FROM users WHERE id = ${id}`;
		return rows[0] ?? null;
	},

	async findByIdOnPrimary(id: number): Promise<User | null> {
		// used for read-your-own-writes — always hits primary
		console.log("Reading from Primary");
		const rows = await db.write<
			User[]
		>`SELECT id, name, location FROM users WHERE id = ${id}`;
		return rows[0] ?? null;
	},

	async create(input: CreateUserInput): Promise<User> {
		const rows = await db.write<User[]>`
      INSERT INTO users (name, location)
      VALUES (${input.name}, ${input.location ?? null})
      RETURNING id, name, location
    `;
		return rows[0];
	},

	async update(id: number, input: UpdateUserInput): Promise<User | null> {
		const rows = await db.write<User[]>`
      UPDATE users
      SET
        name     = COALESCE(${input.name ?? null}, name),
        location = COALESCE(${input.location ?? null}, location)
      WHERE id = ${id}
      RETURNING id, name, location
    `;
		return rows[0] ?? null;
	},

	async delete(id: number): Promise<boolean> {
		const rows = await db.write<{ id: number }[]>`
      DELETE FROM users WHERE id = ${id} RETURNING id
    `;
		return rows.length > 0;
	},
};
