export type Id = string;
export type Quantity = string;
export interface Profile { id:Id; display_name:string; locale:string; timezone:string; revision:number; preferences:Record<string,unknown>; created_at:string }
export interface Family { id:Id; owner_id:Id; family_name:string; platform:'PC'; region:'NA'|'EU' }
export interface Character { id:Id; game_profile_id:Id; name:string; class_name:string; level:number; playstyle:string; notes:string }
export interface Equipment { id:Id; game_profile_id:Id; character_id:Id|null; slot:string|null; name:string; catalog_version_id:Id|null; item_key:string|null; enhancement:number; reform:number; caphras:number; notes:string }
export interface Resource { id:Id; game_profile_id:Id; name:string; quantity:Quantity; item_key:string|null; unit:'items'|'silver' }
export interface Goal { id:Id; game_profile_id:Id; character_id:Id|null; title:string; description:string; priority:number; status:'active'|'paused'|'completed'|'archived'; catalog_version_id:Id|null; created_at:string }
export interface Requirement { resource_id:Id; quantity:Quantity }
export interface Step { id:Id; goal_id:Id; title:string; description:string; position:number; status:'pending'|'completed'; dependencies:Id[]; requirements:Requirement[]; template_key:string|null; claim_key:string|null; reward:{item_key:string;enhancement:number}|null }
export interface Allocation { id:Id; goal_id:Id; resource_id:Id; quantity:Quantity }
export interface Claim { game_profile_id:Id; claim_key:string }
export interface ProgressEvent { id:Id; game_profile_id:Id|null; kind:string; description:string; before_state:Record<string,unknown>|null; after_state:Record<string,unknown>|null; created_at:string; request_id:Id }
export interface CatalogItem { key:string; name:string; slots:string[]; enhancements:number[] }
export interface TemplateStep {key:string;title:string;description:string;dependencies:string[];requirements:{resource_key:string;quantity:Quantity}[];claim_key?:string;reward?:{item_key:string;enhancement:number}}
export interface Catalog { id:Id; version:number; title:string; status:'draft'|'review'|'published'|'retired'; checked_at:string|null; valid_until:string|null; effective_patch:string; sources:{name:string;url:string;checked_at:string;scope?:string}[];content:{platforms:string[];regions:string[];items:CatalogItem[];resources:{key:string;name:string}[];steps:TemplateStep[]} }
export interface Snapshot {capabilities?:string[];profile:Profile;is_admin:boolean;game_profiles:Family[];characters:Character[];equipment:Equipment[];resources:Resource[];goals:Goal[];steps:Step[];allocations:Allocation[];claims:Claim[];events:ProgressEvent[];catalogs:Catalog[]}
export interface Command {kind:string;data:Record<string,unknown>;expected_revision:number;request_id:string}
export const slots = {main_hand:'Main weapon',awakening:'Awakening',off_hand:'Sub-weapon',helmet:'Helmet',armor:'Armor',gloves:'Gloves',shoes:'Shoes',necklace:'Necklace',belt:'Belt',ring_1:'Ring I',ring_2:'Ring II',earring_1:'Earring I',earring_2:'Earring II',alchemy_stone:'Alchemy stone'};
export const enhancementLabel=(n:number)=>n===0?'Base':n<=15?'+'+n:['PRI (I)','DUO (II)','TRI (III)','TET (IV)','PEN (V)','HEX (VI)','SEP (VII)','OCT (VIII)','NOV (IX)','DEC (X)'][n-16]??'Unknown';
