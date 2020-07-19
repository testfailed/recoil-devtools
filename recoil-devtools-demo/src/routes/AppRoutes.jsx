import React from 'react';
import { Route, Switch } from 'react-router-dom';

import Landing from 'app/pages/Landing';

const AppRoutes = (props) => (
  <Switch>
    <Route path="/" component={Landing} {...props} />
  </Switch>
);

export default AppRoutes;
