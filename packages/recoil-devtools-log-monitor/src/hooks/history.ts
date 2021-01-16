import { useCallback, useState } from 'react';
import {
  RecoilState,
  Snapshot,
  useRecoilTransactionObserver_UNSTABLE,
} from 'recoil';

export interface StateTransaction {
  previousState: any;
  nextState: any;
}

export interface State {
  currentInitialIdx: number;
  commitedIdxs: number[];
  current: StateTransaction;
  computedStates: StateTransaction[];
  stagedActionIds: number[];
  snapshotsById: Record<number, Snapshot>;
  actionsById: Record<number, any>;
}

const initialStateValue: State = {
  currentInitialIdx: 0,
  commitedIdxs: [],
  current: { previousState: {}, nextState: {} },
  computedStates: [],
  stagedActionIds: [],
  snapshotsById: {},
  actionsById: {},
};

export const useRecoilTransactionsHistory = (values?: RecoilState<any>[]) => {
  const [state, setState] = useState<State>(initialStateValue);

  const getPayload = (
    { previousState, nextState }: StateTransaction,
    value: any,
    previousValue: any,
    nextValue: any
  ) => ({
    previousState: {
      ...previousState,
      [value.key]: previousValue,
    },
    nextState: {
      ...nextState,
      [value.key]: nextValue,
    },
  });

  const getNextState = (
    currentState: { previousState: any; nextState: any },
    value: any,
    previousValue: any,
    nextValue: any
  ) => {
    const { previousState, nextState } = currentState;

    return {
      previousState: {
        ...previousState,
        [value.key]: previousValue,
      },
      nextState: {
        ...nextState,
        [value.key]: nextValue,
      },
    };
  };

  useRecoilTransactionObserver_UNSTABLE(
    async ({ previousSnapshot, snapshot }) => {
      let payload = { previousState: {}, nextState: {} };
      let currentState: StateTransaction = state.current;

      if (values?.length) {
        values?.forEach(async (value) => {
          const nextValue = await snapshot.getPromise(value);
          const previousValue = await previousSnapshot.getPromise(value);

          payload = getPayload(payload, value, previousValue, nextValue);
          currentState = getNextState(
            currentState,
            value,
            previousValue,
            nextValue
          );
        });
      } else {
        // @ts-ignore
        for (const node of snapshot.getNodes_UNSTABLE({ isModified: true })) {
          const nextValue = await snapshot.getPromise(node);
          const previousValue = await previousSnapshot.getPromise(node);

          payload = getPayload(payload, node, previousValue, nextValue);
          currentState = getNextState(
            currentState,
            node,
            previousValue,
            nextValue
          );
        }
      }

      const {
        actionsById,
        computedStates,
        stagedActionIds,
        snapshotsById,
      } = state;
      const actionId = stagedActionIds.length;
      const nextActionsById = {
        ...actionsById,
        [actionId]: {
          type: 'Updated state',
          ...payload,
        },
      };
      const nextSnapshotsById = {
        ...snapshotsById,
        [actionId]: snapshot,
      };
      const nextComputedStates: StateTransaction[] = [
        ...computedStates,
        { ...currentState },
      ];
      const nextStagedActionIds = [...stagedActionIds, actionId];
      setState({
        ...state,
        actionsById: nextActionsById,
        computedStates: nextComputedStates,
        stagedActionIds: nextStagedActionIds,
        snapshotsById: nextSnapshotsById,
      });
    }
  );

  const handleCommit = useCallback(() => {
    const { commitedIdxs, currentInitialIdx, stagedActionIds } = state;

    setState({
      ...state,
      currentInitialIdx: stagedActionIds.length - 1,
      commitedIdxs: [...commitedIdxs, currentInitialIdx],
    });
  }, []);

  return {
    current: state.current,
    computedStates: state.computedStates.slice(state.currentInitialIdx),
    stagedActionIds: state.stagedActionIds.slice(state.currentInitialIdx),
    actionsById: state.actionsById,
    handleRollback: () => {},
    handleSweep: () => {},
    handleCommit,
    handleReset: () => {},
  };
};
