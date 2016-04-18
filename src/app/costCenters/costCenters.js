angular.module( 'orderCloud' )

    .config( CostCentersConfig )
    .controller( 'CostCentersCtrl', CostCentersController )
    .controller( 'CostCenterEditCtrl', CostCenterEditController )
    .controller( 'CostCenterCreateCtrl', CostCenterCreateController )
    .controller( 'CostCenterAssignCtrl', CostCenterAssignController )

;

function CostCentersConfig( $stateProvider ) {
    $stateProvider
        .state( 'costCenters', {
            parent: 'base',
            url: '/costCenters',
            templateUrl:'costCenters/templates/costCenters.tpl.html',
            controller:'CostCentersCtrl',
            controllerAs: 'costCenters',
            data: {componentName: 'Cost Centers'},
            resolve: {
                CostCenterList: function(OrderCloud) {
                    return OrderCloud.CostCenters.List();
                }
            }
        })
        .state( 'costCenters.edit', {
            url: '/:costCenterid/edit',
            templateUrl:'costCenters/templates/costCenterEdit.tpl.html',
            controller:'CostCenterEditCtrl',
            controllerAs: 'costCenterEdit',
            resolve: {
                SelectedCostCenter: function($stateParams, $state, OrderCloud) {
                    return OrderCloud.CostCenters.Get($stateParams.costCenterid).catch(function() {
                        $state.go('^.costCenters');
                    });
                }
            }
        })
        .state( 'costCenters.create', {
            url: '/create',
            templateUrl:'costCenters/templates/costCenterCreate.tpl.html',
            controller:'CostCenterCreateCtrl',
            controllerAs: 'costCenterCreate'
        })
        .state( 'costCenters.assign', {
            url: '/:costCenterid/assign',
            templateUrl: 'costCenters/templates/costCenterAssign.tpl.html',
            controller: 'CostCenterAssignCtrl',
            controllerAs: 'costCenterAssign',
            resolve: {
                Buyer: function(OrderCloud) {
                    return OrderCloud.Buyers.Get();
                },
                UserGroupList: function(OrderCloud) {
                    return OrderCloud.UserGroups.List(null, 1, 20);
                },
                AssignedUserGroups: function($stateParams, OrderCloud) {
                    return OrderCloud.CostCenters.ListAssignments($stateParams.costCenterid);
                },
                SelectedCostCenter: function($stateParams, $state, OrderCloud) {
                    return OrderCloud.CostCenters.Get($stateParams.costCenterid).catch(function() {
                        $state.go('^');
                    });
                }
            }
        })
}

function CostCentersController( CostCenterList, TrackSearch ) {
    var vm = this;
    vm.list = CostCenterList;
    vm.searching = function() {
        return TrackSearch.GetTerm() ? true : false;
    };

}

function CostCenterEditController( $exceptionHandler, $state, SelectedCostCenter, OrderCloud, toastr ) {
    var vm = this,
        costCenterid = SelectedCostCenter.ID;
    vm.costCenterName = SelectedCostCenter.Name;
    vm.costCenter = SelectedCostCenter;

    vm.Submit = function() {
        OrderCloud.CostCenters.Update(costCenterid, vm.costCenter)
            .then(function() {
                $state.go('costCenters', {}, {reload:true});
                toastr.success('Cost Center Updated', 'Success');
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    };

    vm.Delete = function() {
        OrderCloud.CostCenters.Delete(SelectedCostCenter.ID)
            .then(function() {
                $state.go('costCenters', {}, {reload:true})
                toastr.success('Cost Center Deleted', 'Success');
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    }
}

function CostCenterCreateController( $exceptionHandler,$state, OrderCloud, toastr) {
    var vm = this;
    vm.costCenter = {};

    vm.Submit = function() {
        OrderCloud.CostCenters.Create(vm.costCenter)
            .then(function() {
                $state.go('costCenters', {}, {reload:true})
                toastr.success('Cost Center Created', 'Success');
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    }
}

function CostCenterAssignController(Assignments, Paging, UserGroupList, AssignedUserGroups, SelectedCostCenter, OrderCloud, toastr) {
    var vm = this;
    vm.CostCenter = SelectedCostCenter;
    vm.list = UserGroupList;
    vm.assignments = AssignedUserGroups;
    vm.saveAssignments = SaveAssignment;
    vm.pagingfunction = PagingFunction;

    function SaveFunc(ItemID) {
        return OrderCloud.CostCenters.SaveAssignment({
            UserID: null,
            UserGroupID: ItemID,
            CostCenterID: vm.CostCenter.ID
        });
    }

    function DeleteFunc(ItemID) {
        return OrderCloud.CostCenters.DeleteAssignment(vm.CostCenter.ID, null, ItemID);
    }

    function SaveAssignment() {
        toastr.success('Assignment Updated', 'Success');
        return Assignments.saveAssignments(vm.list.Items, vm.assignments.Items, SaveFunc, DeleteFunc);
    }

    function AssignmentFunc() {
        return OrderCloud.CostCenters.ListAssignments(vm.CostCenter.ID, null, vm.assignments.Meta.PageSize);
    }

    function PagingFunction() {
        return Paging.paging(vm.list, 'UserGroups', vm.assignments, AssignmentFunc);
    }
}

