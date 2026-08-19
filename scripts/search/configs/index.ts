import { type Person, personConfig } from "./person";
import { type Org, orgConfig } from "./org";
import { type Building, buildingConfig } from "./building";

export interface SearchableSet {
  people: Person[];
  //   teams: Team[];
  orgs: Org[];
  //   orgInstances: OrgInstance[];
  //   classes: Course[];
  // subjects: Subject[];
  buildings: Building[];
  //   instruments: Instrument[];
  //   staffRoles: StaffRole[];
  //   titles: Title[];
}

export const allConfigs = {
  people: personConfig,
  //   teams: teamConfig,
  orgs: orgConfig,
  //   orgInstances: orgInstanceConfig,
  //   classes: classConfig,
  // subjects: subjectConfig,
  buildings: buildingConfig,
  //   instruments: instrumentConfig,
  //   staffRoles: staffRoleConfig,
  //   titles: titleConfig,
} as const;
