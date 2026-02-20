import { features } from "../config/features.js";
import {
	userRepository,
	type CreateUserInput,
	type UpdateUserInput,
} from "./user.repository.js";

export const userService = {
	listUsers() {
		return userRepository.findAll();
	},

	async getUser(id: number, forcePrimary = false) {
		const user =
			forcePrimary && features.readReplicas
				? await userRepository.findByIdOnPrimary(id)
				: await userRepository.findById(id);
		if (!user) throw new Error(`User ${id} not found`);
		return user;
	},

	async createUser(input: CreateUserInput) {
		if (!input.name?.trim()) throw new Error("name is required");
		return userRepository.create(input);
	},

	async updateUser(id: number, input: UpdateUserInput) {
		// add more validation on input
		const user = await userRepository.update(id, input);
		if (!user) throw new Error(`User ${id} not found`);
		return user;
	},

	async deleteUser(id: number) {
		const deleted = await userRepository.delete(id);
		if (!deleted) throw new Error(`User ${id} not found`);
	},
};
