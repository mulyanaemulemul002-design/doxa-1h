import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Error, HealthStatus, Holder, LaunchDetail, LaunchSummary, ListLaunchHoldersParams, ListLaunchTradesParams, ListLaunchesParams, NetworkConfig, Trade } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetNetworkConfigUrl: () => string;
/**
 * @summary Get the active testnet configuration
 */
export declare const getNetworkConfig: (options?: Parameters<typeof customFetch>[1]) => Promise<NetworkConfig>;
export declare const getGetNetworkConfigQueryKey: () => readonly ["/api/network"];
export declare const getGetNetworkConfigQueryOptions: <TData = Awaited<ReturnType<typeof getNetworkConfig>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNetworkConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getNetworkConfig>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetNetworkConfigQueryResult = NonNullable<Awaited<ReturnType<typeof getNetworkConfig>>>;
export type GetNetworkConfigQueryError = ErrorType<unknown>;
/**
 * @summary Get the active testnet configuration
 */
export declare function useGetNetworkConfig<TData = Awaited<ReturnType<typeof getNetworkConfig>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNetworkConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLaunchesUrl: (params?: ListLaunchesParams) => string;
/**
 * @summary List indexed token launches
 */
export declare const listLaunches: (params?: ListLaunchesParams, options?: Parameters<typeof customFetch>[1]) => Promise<LaunchSummary[]>;
export declare const getListLaunchesQueryKey: (params?: ListLaunchesParams) => readonly ["/api/launches", ...ListLaunchesParams[]];
export declare const getListLaunchesQueryOptions: <TData = Awaited<ReturnType<typeof listLaunches>>, TError = ErrorType<unknown>>(params?: ListLaunchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLaunches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLaunches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLaunchesQueryResult = NonNullable<Awaited<ReturnType<typeof listLaunches>>>;
export type ListLaunchesQueryError = ErrorType<unknown>;
/**
 * @summary List indexed token launches
 */
export declare function useListLaunches<TData = Awaited<ReturnType<typeof listLaunches>>, TError = ErrorType<unknown>>(params?: ListLaunchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLaunches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetLaunchUrl: (address: string) => string;
/**
 * @summary Get a launch and its latest indexed state
 */
export declare const getLaunch: (address: string, options?: Parameters<typeof customFetch>[1]) => Promise<LaunchDetail>;
export declare const getGetLaunchQueryKey: (address: string) => readonly [`/api/launches/${string}`];
export declare const getGetLaunchQueryOptions: <TData = Awaited<ReturnType<typeof getLaunch>>, TError = ErrorType<Error>>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLaunch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLaunch>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLaunchQueryResult = NonNullable<Awaited<ReturnType<typeof getLaunch>>>;
export type GetLaunchQueryError = ErrorType<Error>;
/**
 * @summary Get a launch and its latest indexed state
 */
export declare function useGetLaunch<TData = Awaited<ReturnType<typeof getLaunch>>, TError = ErrorType<Error>>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLaunch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLaunchTradesUrl: (address: string, params?: ListLaunchTradesParams) => string;
/**
 * @summary List recent indexed trades
 */
export declare const listLaunchTrades: (address: string, params?: ListLaunchTradesParams, options?: Parameters<typeof customFetch>[1]) => Promise<Trade[]>;
export declare const getListLaunchTradesQueryKey: (address: string, params?: ListLaunchTradesParams) => readonly [`/api/launches/${string}/trades`, ...ListLaunchTradesParams[]];
export declare const getListLaunchTradesQueryOptions: <TData = Awaited<ReturnType<typeof listLaunchTrades>>, TError = ErrorType<unknown>>(address: string, params?: ListLaunchTradesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLaunchTrades>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLaunchTrades>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLaunchTradesQueryResult = NonNullable<Awaited<ReturnType<typeof listLaunchTrades>>>;
export type ListLaunchTradesQueryError = ErrorType<unknown>;
/**
 * @summary List recent indexed trades
 */
export declare function useListLaunchTrades<TData = Awaited<ReturnType<typeof listLaunchTrades>>, TError = ErrorType<unknown>>(address: string, params?: ListLaunchTradesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLaunchTrades>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLaunchHoldersUrl: (address: string, params?: ListLaunchHoldersParams) => string;
/**
 * @summary List indexed holder balances
 */
export declare const listLaunchHolders: (address: string, params?: ListLaunchHoldersParams, options?: Parameters<typeof customFetch>[1]) => Promise<Holder[]>;
export declare const getListLaunchHoldersQueryKey: (address: string, params?: ListLaunchHoldersParams) => readonly [`/api/launches/${string}/holders`, ...ListLaunchHoldersParams[]];
export declare const getListLaunchHoldersQueryOptions: <TData = Awaited<ReturnType<typeof listLaunchHolders>>, TError = ErrorType<unknown>>(address: string, params?: ListLaunchHoldersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLaunchHolders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLaunchHolders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLaunchHoldersQueryResult = NonNullable<Awaited<ReturnType<typeof listLaunchHolders>>>;
export type ListLaunchHoldersQueryError = ErrorType<unknown>;
/**
 * @summary List indexed holder balances
 */
export declare function useListLaunchHolders<TData = Awaited<ReturnType<typeof listLaunchHolders>>, TError = ErrorType<unknown>>(address: string, params?: ListLaunchHoldersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLaunchHolders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map