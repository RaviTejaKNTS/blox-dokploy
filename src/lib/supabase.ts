import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

type StubResult = {
  data: unknown;
  error: null;
  count: number;
  status: number;
  statusText: string;
};

class SupabaseQueryStub {
  private listResult(): StubResult {
    return {
      data: [],
      error: null,
      count: 0,
      status: 200,
      statusText: "OK"
    };
  }

  private singleResult(): StubResult {
    return {
      data: null,
      error: null,
      count: 0,
      status: 200,
      statusText: "OK"
    };
  }

  select() { return this; }
  insert() { return this; }
  update() { return this; }
  upsert() { return this; }
  delete() { return this; }
  eq() { return this; }
  neq() { return this; }
  not() { return this; }
  is() { return this; }
  in() { return this; }
  contains() { return this; }
  overlaps() { return this; }
  ilike() { return this; }
  like() { return this; }
  or() { return this; }
  order() { return this; }
  range() { return this; }
  limit() { return this; }
  gt() { return this; }
  gte() { return this; }
  lt() { return this; }
  lte() { return this; }
  textSearch() { return this; }

  maybeSingle() {
    return Promise.resolve(this.singleResult());
  }

  single() {
    return Promise.resolve(this.singleResult());
  }

  then<TResult1 = StubResult, TResult2 = never>(
    onfulfilled?: ((value: StubResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.listResult()).then(onfulfilled as any, onrejected as any);
  }
}

function createBuildSupabaseStub() {
  return {
    from() {
      return new SupabaseQueryStub();
    },
    rpc() {
      return Promise.resolve({
        data: null,
        error: null,
        count: 0,
        status: 200,
        statusText: "OK"
      });
    }
  };
}

export function supabaseAdmin(): SupabaseClient<any, "public", any> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if ((!url || !key) && IS_BUILD) {
    return createBuildSupabaseStub() as unknown as SupabaseClient<any, "public", any>;
  }
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
