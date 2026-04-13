import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    accountId?: string;
    isStaff?: boolean;
  };
  accountId?: string;
}

export type AsyncRequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => Promise<void>;

export interface PrismaDependencies {
  prisma: any;
  getPrismaReady: () => boolean;
}

export interface RouteDependencies extends PrismaDependencies {
  EFFECTIVE_JWT_SECRET?: string;
  EFFECTIVE_JWT_REFRESH_SECRET?: string;
  chaos?: any;
  authenticateToken?: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  requireStaffAccess?: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  verifyFeedAccess?: (feedId: string, accountId: string) => Promise<boolean>;
  verifySourceAccess?: (sourceId: string, accountId: string) => Promise<boolean>;
  verifyItemAccess?: (itemId: string, accountId: string) => Promise<boolean>;
  findUserByEmail?: (email: string) => Promise<any>;
  findUserById?: (userId: string) => Promise<any>;
  issueAuthTokens?: (user: any) => { accessToken: string; refreshToken: string };
  buildAuthUser?: (user: any, req: Request) => any;
  hashAuthActionToken?: (token: string) => string;
  canUseFeature?: (prisma: any, accountId: string, feature: string) => Promise<{ allowed: boolean; message?: string }>;
  getHealthSnapshot?: () => Promise<any>;
}

export interface User {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
  role: string;
  accountid?: string;
  provider?: string;
  password?: string;
  status?: string;
}

export interface Account {
  id: string;
  name: string;
  plan: string;
  email: string;
  trialendsat?: string;
  billingstatus?: string;
  paymentgraceuntil?: string;
}

export interface FeedSource {
  id: string;
  name: string;
  connector: string;
  configjson?: any;
  defaultfreq?: string;
  status?: string;
  lastrunat?: string;
  accountid?: string;
}

export interface Feed {
  id: string;
  name: string;
  sourceid?: string;
  frequency?: string;
  status?: string;
  mappingjson?: any;
  dedupstrategy?: string;
  accountid?: string;
  createdat?: string;
  updatedat?: string;
}

export interface FeedItem {
  id: string;
  feedid?: string;
  title?: string;
  descriptiontext?: string;
  descriptionhtml?: string;
  imageurl?: string;
  url?: string;
  brand?: string;
  sku?: string;
  mpn?: string;
  gtin?: string;
  price?: number;
  currency?: string;
  inventory?: number;
  customfields?: any;
}
