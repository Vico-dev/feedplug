export interface ConditionItem {
  field: string;
  operator: string;
  value?: string | number | string[] | null;
}

export interface ConditionJson {
  operator: "AND" | "OR";
  conditions: ConditionItem[];
}

export interface ActionParams {
  field?: string;
  value?: string | number;
  sourceField?: string;
  template?: string;
  pattern?: string;
  replacement?: string;
  formula?: string;
  fields?: string[];
  separator?: string;
}

export interface ActionJson {
  type: string;
  params: ActionParams;
}

export interface RuleAbTest {
  id: string;
  status: string;
  name: string;
}

export interface Rule {
  id?: string;
  name: string;
  conditionJson: ConditionJson;
  actionJson: ActionJson;
  feedIds?: string[];
  channelIds?: string[];
  destinationIds?: string[];
  startDate?: string | null;
  endDate?: string | null;
  runOnIngestion?: boolean;
  priority?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  abTest?: RuleAbTest | null;
}
