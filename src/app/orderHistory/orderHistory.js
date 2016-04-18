angular.module( 'orderCloud' )

    .config( OrderHistoryConfig )
    .controller( 'OrderHistoryCtrl', OrderHistoryController )
    .controller( 'OrderHistoryDetailCtrl', OrderHistoryDetailController )
    .controller( 'OrderHistoryDetailLineItemCtrl', OrderHistoryDetailLineItemController )
    .factory( 'OrderHistoryFactory', OrderHistoryFactory )
    .directive( 'ordercloudOrderSearch', ordercloudOrderSearch )
    .controller( 'OrderHistorySearchCtrl', OrderHistorySearchController )
    .filter('paymentmethods', paymentmethods)
    .factory('RepeatOrderFactory', RepeatOrderFactory)
    .controller('RepeatOrderCtrl', RepeatOrderController)
    .directive('ordercloudRepeatOrder', OrderCloudRepeatOrderDirective)
;

function OrderHistoryConfig( $stateProvider ) {
    $stateProvider
        .state( 'orderHistory', {
            parent: 'base',
            url: '/order-history',
            templateUrl:'orderHistory/templates/orderHistory.list.tpl.html',
            controller:'OrderHistoryCtrl',
            controllerAs: 'orderHistory',
            data: {componentName: 'Order History'},
            resolve: {
                UserType: function(OrderCloud) {
                    return JSON.parse(atob(OrderCloud.Auth.ReadToken().split('.')[1])).usrtype;
                },
                OrderList: function(OrderCloud, UserType) {
                    return OrderCloud.Orders.List((UserType == 'admin' ? 'incoming' : 'outgoing'));
                },
                BuyerCompanies: function( $q, OrderCloud, UserType ) {
                    var deferred = $q.defer();

                    if (UserType == 'admin') {
                        var returnObject = {};
                        var queue = [];
                        OrderCloud.Buyers.List(null, 1, 100)
                            .then(function(data) {
                                returnObject = data;
                                for (var i = 1; i < data.Meta.TotalPages; i++) {
                                    queue.push(OrderCloud.Buyers.List(null, i, 100));
                                }

                                if (queue.length) {
                                    $q.all(queue).then(function(results) {
                                        angular.forEach(results, function(result) {
                                            returnObject.Items = returnObject.concat(result.Items);
                                            deferred.resolve(returnObject);
                                        });
                                    });
                                }
                                else {
                                    deferred.resolve(returnObject);
                                }
                            });
                    }
                    else {
                        deferred.resolve();
                    }

                    return deferred.promise;
                }
            }
        })
        .state( 'orderHistory.detail', {
            url: '/:orderid',
            templateUrl: 'orderHistory/templates/orderHistory.detail.tpl.html',
            controller: 'OrderHistoryDetailCtrl',
            controllerAs: 'orderHistoryDetail',
            resolve: {
                SelectedOrder: function($stateParams, OrderHistoryFactory) {
                    return OrderHistoryFactory.GetOrderDetails($stateParams.orderid);
                }
            }
        })
        .state( 'orderHistory.detail.lineItem', {
            url: '/:lineitemid',
            templateUrl: 'orderHistory/templates/orderHistory.detail.lineItem.tpl.html',
            controller: 'OrderHistoryDetailLineItemCtrl',
            controllerAs: 'orderHistoryDetailLineItem',
            resolve: {
                SelectedLineItem: function($stateParams, OrderHistoryFactory) {
                    return OrderHistoryFactory.GetLineItemDetails($stateParams.orderid, $stateParams.lineitemid);
                }
            }
        })
    ;
}

function OrderHistoryController( OrderList, UserType, BuyerCompanies ) {
    var vm = this;
    vm.list = OrderList;
    vm.userType = UserType;
    vm.buyerCompanies = BuyerCompanies;

    vm.filters = {};
}

function OrderHistoryDetailController( SelectedOrder ) {
    var vm = this;
    vm.order = SelectedOrder;
}

function OrderHistoryDetailLineItemController( SelectedLineItem ) {
    var vm = this;
    vm.lineItem = SelectedLineItem;
}

function OrderHistoryFactory( $q, Underscore, OrderCloud ) {
    var service = {
        GetOrderDetails: _getOrderDetails,
        GetLineItemDetails: _getLineItemDetails,
        SearchOrders: _searchOrders
    };

    function _getOrderDetails(orderID) {
        var deferred = $q.defer();
        var order;
        var lineItemQueue = [];
        var productQueue = [];

        OrderCloud.Orders.Get(orderID)
            .then(function(data) {
                order = data;
                order.LineItems = [];
                gatherLineItems();
            });

        function gatherLineItems() {
            OrderCloud.LineItems.List(orderID, 1, 100)
                .then(function(data) {
                    order.LineItems = order.LineItems.concat(data.Items);
                    for (var i = 2; i <= data.Meta.TotalPages; i++) {
                        lineItemQueue.push(OrderCloud.LineItems.List(orderID, i, 100));
                    }
                    $q.all(lineItemQueue).then(function(results) {
                        angular.forEach(results, function(result) {
                            order.LineItems = order.LineItems.concat(result.Items);
                        });
                        gatherProducts();
                    });
                });
        }

        function gatherProducts() {
            var productIDs = Underscore.uniq(Underscore.pluck(order.LineItems, 'ProductID'));

            angular.forEach(productIDs, function(productID) {
                productQueue.push((function() {
                    var d = $q.defer();

                    OrderCloud.Products.Get(productID)
                        .then(function(product) {
                            angular.forEach(Underscore.where(order.LineItems, {ProductID: product.ID}), function(item) {
                                item.Product = product;
                            });

                            d.resolve();
                        });

                    return d.promise;
                })());
            });

            $q.all(productQueue).then(function() {
                if (order.SpendingAccountID) {
                    OrderCloud.SpendingAccounts.Get(order.SpendingAccountID)
                        .then(function(sa) {
                            order.SpendingAccount = sa;
                            deferred.resolve(order);
                        });
                }
                else {
                    deferred.resolve(order);
                }
            });
        }

        return deferred.promise;
    }

    function _getLineItemDetails(orderID, lineItemID) {
        var deferred = $q.defer();
        var lineItem;

        OrderCloud.LineItems.Get(orderID, lineItemID)
            .then(function(li) {
                lineItem = li;
                getProduct();
            });

        function getProduct() {
            OrderCloud.Products.Get(lineItem.ProductID)
                .then(function(product) {
                    lineItem.Product = product;
                    deferred.resolve(lineItem);
                });
        }

        return deferred.promise;
    }

    function _searchOrders(filters, userType) {
        var deferred = $q.defer();

        OrderCloud.Orders.List((userType == 'admin' ? 'incoming' : 'outgoing'), filters.FromDate, filters.ToDate, filters.searchTerm, 1, 100, null, null, {ID: filters.OrderID, Status: filters.Status}, filters.FromCompanyID)
            .then(function(data) {
                deferred.resolve(data);
            });

        return deferred.promise;
    }

    return service;
}

function ordercloudOrderSearch() {
    return {
        scope: {
            controlleras: '=',
            filters: '=',
            usertype: '@',
            buyercompanies: '='
        },
        restrict: 'E',
        templateUrl: 'orderHistory/templates/orderHistory.search.tpl.html',
        controller: 'OrderHistorySearchCtrl',
        controllerAs: 'ocOrderSearch',
        replace: true
    }
}

function OrderHistorySearchController( $scope, $timeout, OrderHistoryFactory ) {
    var vm = this;
    $scope.statuses = [
        {Name: 'Unsubmitted', Value: 'Unsubmitted'},
        {Name: 'Open', Value: 'Open'},
        {Name: 'Awaiting Approval', Value: 'AwaitingApproval'},
        {Name: 'Completed', Value: 'Completed'},
        {Name: 'Declined', Value: 'Declined'},
        {Name: 'Cancelled', Value: 'Cancelled'}
    ];

    var searching;
    $scope.$watch('filters', function(n,o) {
        if (n == o) {
            if (searching) $timeout.cancel(searching);
        } else {
            if (searching) $timeout.cancel(searching);
            searching = $timeout(function() {
                angular.forEach($scope.filters, function(value, key) {
                   value == '' ? $scope.filters[key] = null : angular.noop();
                });

                OrderHistoryFactory.SearchOrders($scope.filters, $scope.usertype)
                    .then(function(data) {
                        $scope.controlleras.list = data;
                    });

            }, 300);
        }
    }, true);
}

function paymentmethods() {
    var map = {
        'PurchaseOrder': 'Purchase Order',
        'CreditCard': 'CreditCard',
        'SpendingAccount': 'Spending Account',
        'PayPalExpressCheckout': 'PayPal Express Checkout'
    };
    return function(method) {
        if (!map[method]) return method;
        return map[method];
    }
}

function RepeatOrderFactory($q, OrderCloud, LineItemHelpers, CurrentOrder) {

    return {
        Reorder: Reorder
    };

    function Reorder(orderID) {

        var deferred = $q.defer();
        var lineItems;
        var order;

        OrderCloud.Orders.Create({})
            .then(function (data) {
                order = data;
                CurrentOrder.Set(order.ID);
                listLineItems();

            });

        function listLineItems() {
            LineItemHelpers.ListAll(orderID)
                .then(function (li) {
                    lineItems = li;
                    createLineItems();
                });
        }

        function createLineItems() {
            var queue = [];

            angular.forEach(lineItems, function (lineItem) {
                delete lineItem.OrderID;
                delete lineItem.ID;
                delete lineItem.QuantityShipped;
                queue.push(OrderCloud.LineItems.Create(order.ID, lineItem));
            });

            $q.all(queue).then(function () {
                deferred.resolve();
            });

        }

        return deferred.promise;


    }


}

function RepeatOrderController($state, RepeatOrderFactory) {

    var vm = this;

    vm.reorder = function(orderID){
        RepeatOrderFactory.Reorder(orderID).then(function(){
            $state.go('cart', {}, {reload:true});
        });
    }
}

function OrderCloudRepeatOrderDirective() {
    return {
        restrict: 'E',
        templateUrl: 'orderHistory/templates/repeatOrder.tpl.html',
        controller: 'RepeatOrderCtrl',
        controllerAs: 'repeat',
        scope: {
            orderid: '='
        }
    }

}