import Ember from 'ember';
import * as D3 from 'npm:d3';

function compute() {
  D3.select(this.get('element'));
  return { value: 'from component' };
}
export default Ember.Component.extend({
  someValue: compute()
});
