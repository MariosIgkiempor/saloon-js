import { describe, expect, it } from 'vitest';
import { FAKE_RESPONSE_BRAND, type FakeResponse } from '@/contracts/FakeResponse';
import type { Response } from '@/contracts/Response';
import { PipeOrder } from '@/enums';
import { createMiddlewarePipeline } from '@/helpers/middlewarePipeline';
import type { PendingRequest } from '@/http/pendingRequest';
import { createArrayStore } from '@/repositories/arrayStore';
import { jsonBody } from '@/repositories/body';

// A minimal pending request: the request pipeline only ever touches the fake-
// response slot, so the rest of the shape is irrelevant here.
function stubPending(): PendingRequest {
  let fake: FakeResponse | undefined;
  return {
    setFakeResponse(next: FakeResponse) {
      fake = next;
    },
    getFakeResponse: () => fake,
    hasFakeResponse: () => fake !== undefined,
  } as unknown as PendingRequest;
}

function stubFakeResponse(status = 200): FakeResponse {
  return {
    [FAKE_RESPONSE_BRAND]: true,
    status: () => status,
    headers: () => createArrayStore<string>(),
    body: () => jsonBody(),
  };
}

// A minimal response: the response pipeline only compares identity here.
const stubResponse = (status: number): Response =>
  ({ status: () => status }) as unknown as Response;

describe('createMiddlewarePipeline', () => {
  describe('request pipeline', () => {
    it('runs request pipes in registration order', async () => {
      const pipeline = createMiddlewarePipeline();
      const order: string[] = [];
      pipeline.onRequest(() => void order.push('a'));
      pipeline.onRequest(() => void order.push('b'));
      pipeline.onRequest(() => void order.push('c'));

      await pipeline.executeRequestPipeline(stubPending());

      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('honors PipeOrder.First (prepend) and Last (append)', async () => {
      const pipeline = createMiddlewarePipeline();
      const order: string[] = [];
      pipeline.onRequest(() => void order.push('middle'));
      pipeline.onRequest(() => void order.push('first'), undefined, PipeOrder.First);
      pipeline.onRequest(() => void order.push('last'), undefined, PipeOrder.Last);

      await pipeline.executeRequestPipeline(stubPending());

      expect(order).toEqual(['first', 'middle', 'last']);
    });

    it('awaits async pipes before running the next', async () => {
      const pipeline = createMiddlewarePipeline();
      const order: string[] = [];
      pipeline.onRequest(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push('async');
      });
      pipeline.onRequest(() => void order.push('sync'));

      await pipeline.executeRequestPipeline(stubPending());

      expect(order).toEqual(['async', 'sync']);
    });

    it('uses a pipe-returned PendingRequest as the new payload', async () => {
      const pipeline = createMiddlewarePipeline();
      const replacement = stubPending();
      pipeline.onRequest(() => replacement);

      const result = await pipeline.executeRequestPipeline(stubPending());

      expect(result).toBe(replacement);
    });

    it('stashes a returned FakeResponse but keeps running the remaining pipes', async () => {
      const pipeline = createMiddlewarePipeline();
      const pending = stubPending();
      const ran: string[] = [];
      pipeline.onRequest(() => void ran.push('before'));
      pipeline.onRequest(() => stubFakeResponse(418));
      pipeline.onRequest(() => void ran.push('after'));

      const result = await pipeline.executeRequestPipeline(pending);

      expect(result).toBe(pending);
      expect(pending.hasFakeResponse()).toBe(true);
      expect(pending.getFakeResponse()?.status()).toBe(418);
      // The fake response stops the sender, not the remaining request pipes.
      expect(ran).toEqual(['before', 'after']);
    });
  });

  describe('response pipeline', () => {
    it('replaces the response when a pipe returns one', async () => {
      const pipeline = createMiddlewarePipeline();
      const replacement = stubResponse(201);
      pipeline.onResponse(() => replacement);

      const result = await pipeline.executeResponsePipeline(stubResponse(200));

      expect(result).toBe(replacement);
    });

    it('passes the response through when a pipe returns void', async () => {
      const pipeline = createMiddlewarePipeline();
      const original = stubResponse(200);
      let seen: Response | undefined;
      pipeline.onResponse((response) => {
        seen = response;
      });

      const result = await pipeline.executeResponsePipeline(original);

      expect(seen).toBe(original);
      expect(result).toBe(original);
    });
  });

  describe('fatal pipeline', () => {
    it('runs each fatal pipe with the error', async () => {
      const pipeline = createMiddlewarePipeline();
      const seen: Error[] = [];
      pipeline.onFatalException((error) => void seen.push(error));
      const error = new Error('boom');

      await pipeline.executeFatalPipeline(error);

      expect(seen).toEqual([error]);
    });
  });

  describe('merge', () => {
    it('concatenates another pipeline, preserving order', async () => {
      const a = createMiddlewarePipeline();
      const b = createMiddlewarePipeline();
      const order: string[] = [];
      a.onRequest(() => void order.push('a1'));
      a.onRequest(() => void order.push('a2'));
      b.onRequest(() => void order.push('b1'));

      a.merge(b);
      await a.executeRequestPipeline(stubPending());

      expect(order).toEqual(['a1', 'a2', 'b1']);
    });

    it('is chainable and returns self', () => {
      const a = createMiddlewarePipeline();
      expect(a.merge(createMiddlewarePipeline())).toBe(a);
    });
  });
});
