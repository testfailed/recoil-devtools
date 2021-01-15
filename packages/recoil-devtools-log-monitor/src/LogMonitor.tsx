import React, { FC, useState } from 'react';
import { RecoilState, useRecoilTransactionObserver_UNSTABLE } from 'recoil';
import * as themes from 'recoil-devtools-themes';
import { Base16Theme } from 'base16';
import LogMonitorButtonBar from './LogMonitorButtonBar';
import LogMonitorEntryList from './LogMonitorEntryList';

const styles: {
  container: React.CSSProperties;
  elements: React.CSSProperties;
} = {
  container: {
    fontFamily: 'monaco, Consolas, Lucida Console, monospace',
    position: 'relative',
    overflowY: 'hidden',
    width: '100%',
    height: '100%',
    minWidth: 300,
    direction: 'ltr',
  },
  elements: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflowX: 'hidden',
    overflowY: 'auto',
  },
};

export interface LogMonitorProps {
  values?: RecoilState<any>[];
  select?: (state: any) => unknown;
  theme?: keyof typeof themes | Base16Theme;
  expandActionRoot?: boolean;
  expandStateRoot?: boolean;
  markStateDiff?: boolean;
  hideMainButtons?: boolean;
}

type StateTransaction = { previousState: {}, nextState: {} }
interface State {
  current: StateTransaction,
  computedStates: StateTransaction[],
  stagedActionIds: number[],
  actionsById: { [key: number]: any }
}

const LogMonitor: FC<LogMonitorProps> = ({
  values,
  select = (state: unknown) => state,
  theme = 'ulisesjcf',
  expandActionRoot = true,
  expandStateRoot = true,
  markStateDiff = false,
  hideMainButtons = false,
}) => {
  const [state, setState] = useState<State>({
    current: { previousState: {}, nextState: {} },
    computedStates: [],
    stagedActionIds: [],
    actionsById: {},
  })

  const getTheme = () => {
    if (typeof theme !== 'string') {
      return theme;
    }

    if (typeof themes[theme] !== 'undefined') {
      return themes[theme];
    }

    console.warn(
      'DevTools theme ' + theme + ' not found, defaulting to ulisesjcf'
    );
    return themes.ulisesjcf;
  };

  const getPayload = (
    { previousState, nextState }: { previousState: any; nextState: any },
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

  const getNextState = (currentState: { previousState: any, nextState: any }, value: any, previousValue: any, nextValue: any) => {
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
      let currentState: StateTransaction = state.current

      if (values?.length) {
        values?.forEach(async (value) => {
          const nextValue = await snapshot.getPromise(value);
          const previousValue = await previousSnapshot.getPromise(value);

          payload = getPayload(payload, value, previousValue, nextValue);
          currentState = getNextState(currentState, value, previousValue, nextValue);
        });
      } else {
        for (const node of snapshot.getNodes_UNSTABLE({ isModified: true })) {
          const nextValue = await snapshot.getPromise(node);
          const previousValue = await previousSnapshot.getPromise(node);

          payload = getPayload(payload, node, previousValue, nextValue);
          currentState = getNextState(currentState, node, previousValue, nextValue);
        }
      }

      const { actionsById, computedStates, stagedActionIds } = state;
      const actionId = stagedActionIds.length;
      const nextActionsById = {
        ...actionsById,
        [actionId]: {
          type: 'Updated state',
          ...payload,
        },
      };
      const nextComputedStates: StateTransaction[] = [...computedStates, { ...currentState }];
      const nextStagedActionIds = [...stagedActionIds, actionId];
      setState({
        ...state,
        actionsById: nextActionsById,
        computedStates: nextComputedStates,
        stagedActionIds: nextStagedActionIds,
      });
    }
  );

  const logMonitorTheme = getTheme();

  const { actionsById, computedStates, stagedActionIds } = state

  const entryListProps = {
    theme: logMonitorTheme,
    select,
    expandActionRoot,
    expandStateRoot,
    markStateDiff,
    actionsById,
    computedStates,
    stagedActionIds,
    skippedActionIds: [],
    currentStateIndex: 0,
    consecutiveToggleStartId: 0,
    onActionClick: () => {},
    onActionShiftClick: () => {},
  };

  console.log({ entryListProps });

  return (
    <div
      style={{ ...styles.container, backgroundColor: logMonitorTheme.base00 }}
    >
      {!hideMainButtons && (
        <LogMonitorButtonBar
          theme={logMonitorTheme}
          hasStates={computedStates.length > 0}
          hasSkippedActions={false}
        />
      )}
      <div
        style={
          hideMainButtons ? styles.elements : { ...styles.elements, top: 30 }
        }
      >
        <LogMonitorEntryList {...entryListProps} />
      </div>
    </div>
  );
};

export default LogMonitor;
