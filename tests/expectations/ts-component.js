import Ember from 'ember';
function compute() {
  return { value: 'from component' };
}
export default Ember.Component.extend({
  someValue: compute()
});
