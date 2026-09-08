create index characters_family_owner on app_private.characters(game_profile_id,owner_id);
create index equipment_character_owner on app_private.equipment_instances(character_id,owner_id);
create index claims_family_owner on app_private.family_claims(game_profile_id,owner_id);
create index steps_goal_owner on app_private.goal_steps(goal_id,owner_id);
create index allocations_goal_owner on app_private.resource_allocations(goal_id,owner_id);
create index balances_family_owner on app_private.resource_balances(game_profile_id,owner_id);
